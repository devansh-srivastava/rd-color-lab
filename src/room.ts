import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getDatabase, get, onDisconnect, onValue, ref, runTransaction, set, type Database, type Unsubscribe } from 'firebase/database'
import { applyMove, firstLevel, getLevel, initialState, type GameState, type LevelId, type Player } from './game'

export const ROOM_CODE = '112211'
const base = `rooms/${ROOM_CODE}`

export type RoomSnapshot = { levelId: LevelId; game: GameState; history: GameState[]; revealed: Record<Player, boolean> }
type GameRecord = { state: GameState; history: GameState[] }
type RoomData = {
  schemaVersion: number
  seats: Record<Player, string>
  online: Record<Player, boolean>
  game: GameRecord
  games?: Record<string, GameRecord>
  activeLevel?: LevelId
  revealed: Record<Player, boolean>
  restart: { from: Player | ''; response: '' | 'yes' | 'no'; levelId?: LevelId }
}

function initialRoom(): RoomData {
  return {
    schemaVersion: 1,
    seats: { devansh: '', ridhima: '' },
    online: { devansh: false, ridhima: false },
    game: { state: initialState(), history: [] },
    activeLevel: firstLevel,
    revealed: { devansh: false, ridhima: false },
    restart: { from: '', response: '' },
  }
}

function gameRecord(value: Partial<GameRecord> | null, levelId: LevelId = firstLevel): GameRecord {
  const fallback = initialState(levelId)
  const state = value?.state ?? fallback
  return {
    state: {
      ...state,
      tubes: (state.tubes ?? fallback.tubes).map(tube => ({ ...tube, colors: tube.colors ?? [] })),
      lastMove: state.lastMove ?? null,
    },
    history: (value?.history ?? []).map(previous => ({
      ...previous,
      tubes: previous.tubes.map(tube => ({ ...tube, colors: tube.colors ?? [] })),
      lastMove: previous.lastMove ?? null,
    })),
  }
}

function config() {
  const env = import.meta.env
  const settings = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }
  if (Object.values(settings).some(value => !value)) throw new Error('Firebase setup is incomplete on this website.')
  return settings
}

export class Room {
  private db: Database | null = null
  private uid = ''
  private latest: RoomData | null = null
  private networkOnline = false
  private unsubscribers: Unsubscribe[] = []
  private closed = false
  private prompted = false
  private finishingRestart = false
  private activeLevel: LevelId = firstLevel

  constructor(
    readonly role: Player,
    private readonly onSnapshot: (snapshot: RoomSnapshot) => void,
    private readonly onStatus: (connected: boolean, text: string) => void,
    private readonly onNotice: (text: string) => void,
    private readonly onRestartRequest: (levelId: LevelId) => void,
  ) {
    void this.start()
  }

  private at(path = '') {
    if (!this.db) throw new Error('Room is not ready.')
    return ref(this.db, path ? `${base}/${path}` : base)
  }

  private async start() {
    try {
      const app = initializeApp(config())
      const auth = getAuth(app)
      const db = getDatabase(app)
      await auth.authStateReady()
      this.uid = (auth.currentUser ?? (await signInAnonymously(auth)).user).uid
      if (this.closed) return
      this.db = db
      const roomRef = this.at()
      await runTransaction(roomRef, current => current === null ? initialRoom() : undefined, { applyLocally: false })
      const beforeClaim = (await get(roomRef)).val() as RoomData | null
      if (!beforeClaim) throw new Error('Could not open the room. Check the database rules.')
      const friend = this.role === 'devansh' ? 'ridhima' : 'devansh'
      if (beforeClaim.seats?.[friend] === this.uid) throw new Error('This browser already owns the other station. Choose that name or use the other phone.')
      const seat = await runTransaction(this.at(`seats/${this.role}`), current =>
        current === null || current === '' || current === this.uid ? this.uid : undefined,
      )
      if (!seat.committed || seat.snapshot.val() !== this.uid) throw new Error(`${this.role === 'devansh' ? 'Devansh' : 'Riddsss'} is already selected on another phone.`)
      if (this.closed) {
        await runTransaction(this.at(`seats/${this.role}`), current => current === this.uid ? '' : undefined)
        return
      }
      this.unsubscribers.push(onValue(roomRef, snapshot => this.receive(snapshot.val() as RoomData | null), () => this.onStatus(false, 'Room access was denied. Check Firebase rules.')))
      this.unsubscribers.push(onValue(ref(this.db, '.info/connected'), snapshot => {
        this.networkOnline = snapshot.val() === true
        if (this.networkOnline && !this.closed) void this.markOnline()
        this.updateStatus()
      }))
    } catch (error) {
      this.onStatus(false, error instanceof Error ? error.message : 'Could not join the room.')
    }
  }

  private async markOnline() {
    try {
      const onlineRef = this.at(`online/${this.role}`)
      await onDisconnect(onlineRef).set(false)
      await set(onlineRef, true)
    } catch { this.onStatus(false, 'Could not mark this phone online. Check Firebase rules.') }
  }

  private receive(value: RoomData | null) {
    if (!value || this.closed) return
    this.latest = value
    const levelId = getLevel(value.activeLevel ?? firstLevel).id
    this.activeLevel = levelId
    const record = gameRecord(levelId === firstLevel ? value.game : value.games?.[levelId] ?? null, levelId)
    this.onSnapshot({ levelId, game: record.state, history: record.history, revealed: value.revealed ?? { devansh: false, ridhima: false } })
    this.updateStatus()
    const friend = this.role === 'devansh' ? 'ridhima' : 'devansh'
    if (!value.restart?.from) this.prompted = false
    if (value.restart?.from === friend && value.restart.response === '' && !this.prompted) {
      this.prompted = true
      this.onRestartRequest(getLevel(value.restart.levelId ?? firstLevel).id)
    }
    if (value.restart?.from === this.role && value.restart.response && !this.finishingRestart) void this.finishRestart(value.restart.response, getLevel(value.restart.levelId ?? firstLevel).id)
  }

  private updateStatus() {
    const friend = this.role === 'devansh' ? 'ridhima' : 'devansh'
    if (!this.networkOnline) this.onStatus(false, 'Reconnecting to the room…')
    else if (!this.latest?.online?.[friend]) this.onStatus(false, `Waiting for ${friend === 'devansh' ? 'Devansh' : 'Riddsss'}…`)
    else this.onStatus(true, 'Connected')
  }

  async move(from: string, to: string) {
    try {
      const levelId = this.activeLevel
      const result = await runTransaction(this.at(this.gamePath(levelId)), current => {
        if (!current) return undefined
        const record = gameRecord(current as GameRecord, levelId)
        const move = applyMove(record.state, this.role, from, to)
        if (!move.ok) return undefined
        return { state: move.state, history: [...record.history, record.state].slice(-50) } satisfies GameRecord
      }, { applyLocally: false })
      if (!result.committed) this.onNotice('That pour is no longer available. Try again.')
    } catch { this.onNotice('Could not save the pour. Check your connection.') }
  }

  async undo() {
    try {
      const levelId = this.activeLevel
      const result = await runTransaction(this.at(this.gamePath(levelId)), current => {
        if (!current) return undefined
        const record = gameRecord(current as GameRecord, levelId)
        const previous = record.history.at(-1)
        if (!previous || record.state.lastMove?.actor !== this.role) return undefined
        return { state: { ...previous, revision: record.state.revision + 1, lastMove: null }, history: record.history.slice(0, -1) } satisfies GameRecord
      }, { applyLocally: false })
      if (!result.committed) this.onNotice('Only the player who made the last pour can undo it.')
    } catch { this.onNotice('Could not undo. Check your connection.') }
  }

  async setReveal(value: boolean) {
    try { await set(this.at(`revealed/${this.role}`), value) }
    catch { this.onNotice('Could not change visibility. Check your connection.') }
  }

  private gamePath(levelId: LevelId) { return levelId === firstLevel ? 'game' : `games/${levelId}` }

  async selectLevel(levelId: LevelId) {
    try {
      if (levelId !== firstLevel) {
        await runTransaction(this.at(this.gamePath(levelId)), current =>
          current === null ? { state: initialState(levelId), history: [] } satisfies GameRecord : undefined,
          { applyLocally: false },
        )
      }
      await set(this.at('activeLevel'), levelId)
    } catch { this.onNotice('Could not open that level. Check your connection.') }
  }

  async requestRestart() {
    try {
      const result = await runTransaction(this.at('restart'), current =>
        !current?.from ? { from: this.role, response: '', levelId: this.activeLevel } : undefined,
      )
      if (!result.committed) this.onNotice('A restart request is already waiting.')
    } catch { this.onNotice('Could not request a restart.') }
  }

  async respondRestart(accepted: boolean) {
    try {
      await runTransaction(this.at('restart'), current =>
        current?.from && current.from !== this.role && current.response === ''
          ? { ...current, response: accepted ? 'yes' : 'no' }
          : undefined,
      )
    } catch { this.onNotice('Could not answer the restart request.') }
  }

  private async finishRestart(response: 'yes' | 'no', levelId: LevelId) {
    this.finishingRestart = true
    try {
      if (response === 'yes') {
        await runTransaction(this.at(this.gamePath(levelId)), current => {
          if (!current) return undefined
          const record = gameRecord(current as GameRecord, levelId)
          return { state: { ...initialState(levelId), revision: record.state.revision + 1 }, history: [] } satisfies GameRecord
        }, { applyLocally: false })
      } else this.onNotice('Your friend kept the current game.')
      await set(this.at('restart'), { from: '', response: '' })
    } catch { this.onNotice('Could not finish the restart.') }
    finally { this.finishingRestart = false }
  }

  async leave() {
    try {
      await onDisconnect(this.at(`online/${this.role}`)).cancel()
      await set(this.at(`online/${this.role}`), false)
      await runTransaction(this.at(`seats/${this.role}`), current => current === this.uid ? '' : undefined)
    } catch { /* The same anonymous browser can still resume its seat. */ }
    this.close()
  }

  close() {
    this.closed = true
    this.unsubscribers.forEach(unsubscribe => unsubscribe())
    this.unsubscribers = []
  }
}
