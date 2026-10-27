import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  firstLevel,
  getLevel,
  isSolved,
  legalDestinations,
  levels,
  type Color,
  type LevelId,
  type Player,
  type Tube as TubeData,
} from "./game";
import { isMuted, playCue, startAudio, toggleMute } from "./audio";
import { Room, ROOM_CODE, type RoomSnapshot } from "./room";

const names: Record<Player, string> = {
  devansh: "Devansh",
  ridhima: "Riddsss",
};
const paint: Record<Color, string> = {
  rose: "#efa2aa",
  blue: "#a9c9ee",
  gold: "#f1d999",
  mint: "#a8ddc4",
  lilac: "#c7b5ec",
  peach: "#f3bd9e",
  teal: "#8ed8dc",
};

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        RD <b>COLOR LAB</b>
      </span>
    </div>
  );
}

function Tube({
  tube,
  selected,
  legal,
  hinted,
  locked,
  hidden,
  moving,
  onClick,
}: {
  tube: TubeData;
  selected: boolean;
  legal: boolean;
  hinted: boolean;
  locked: boolean;
  hidden: boolean;
  moving: boolean;
  onClick: () => void;
}) {
  const clip = `clip-${tube.id}`;
  return (
    <button
      className={`tube-button${selected ? " selected" : ""}${legal ? " legal" : ""}${hinted ? " hinted" : ""}${locked ? " locked" : ""}${moving ? " moving" : ""}${hidden ? " hidden-paint" : ""}`}
      onClick={onClick}
      aria-label={
        hidden
          ? `${tube.id}, colors hidden by your friend`
          : `${tube.id}, ${tube.colors.length ? tube.colors.join(", ") : "empty"}${locked ? ", friend’s tube" : ""}`
      }
      aria-pressed={selected}
      type="button"
    >
      <svg viewBox="0 0 82 120" role="presentation" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <path d="M13 11 V97 Q13 111 27 111 H55 Q69 111 69 97 V11 Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {tube.colors.map((color, index) => (
            <rect
              key={index}
              x="13"
              y={111 - (index + 1) * 25}
              width="56"
              height="25"
              fill={hidden ? "#666977" : paint[color]}
              className="liquid"
            />
          ))}
          {tube.colors.length > 0 && (
            <path
              d={`M13 ${111 - tube.colors.length * 25} Q26 ${108 - tube.colors.length * 25} 41 ${111 - tube.colors.length * 25} T69 ${111 - tube.colors.length * 25}`}
              fill="none"
              stroke="#fff9"
              strokeWidth="2"
            />
          )}
        </g>
        <path
          d="M13 11 V97 Q13 111 27 111 H55 Q69 111 69 97 V11"
          fill="none"
          stroke="#e8e8ec"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M8 11 H74"
          stroke="#e8e8ec"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M20 20 V91"
          stroke="#fff8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>{tube.id === "S" ? "SHARED" : tube.id}</span>
    </button>
  );
}

function Entry({ onEnter }: { onEnter: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (code !== ROOM_CODE) {
      setError("That room code is not right.");
      return;
    }
    startAudio();
    onEnter();
  }
  return (
    <main className="entry-shell">
      <div className="entry-card">
        <Brand />
        <p className="eyebrow">A GAME FOR TWO</p>
        <h1>
          One little lab.
          <br />
          <em>Two bright minds.</em>
        </h1>
        <p className="entry-copy">
          Enter your room code to join the color sorting game.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="room-code">ROOM CODE</label>
          <input
            id="room-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="••••••"
            aria-describedby={error ? "code-error" : undefined}
          />
          <button type="submit" disabled={code.length !== 6}>
            Continue <span>↗</span>
          </button>
        </form>
        {error && (
          <p id="code-error" className="entry-error" role="alert">
            {error}
          </p>
        )}
        <p className="entry-foot">SIX LEVELS · ONE SHARED LAB</p>
      </div>
    </main>
  );
}

function SeatPicker({ onChoose }: { onChoose: (role: Player) => void }) {
  return (
    <main className="entry-shell">
      <div className="entry-card">
        <Brand />
        <p className="eyebrow">ROOM {ROOM_CODE}</p>
        <h1>
          Which station
          <br />
          <em>is yours?</em>
        </h1>
        <p className="entry-copy">
          Pick your name. Your own tubes are always visible; your partner
          chooses whether to reveal theirs.
        </p>
        <div className="seat-options">
          <button onClick={() => onChoose("devansh")} type="button">
            <span className="seat-letter">D</span>
            <span>
              <b>Devansh</b>
              <small>Choose this station</small>
            </span>
            <strong>↗</strong>
          </button>
          <button onClick={() => onChoose("ridhima")} type="button">
            <span className="seat-letter blue">R</span>
            <span>
              <b>Riddsss</b>
              <small>Choose this station</small>
            </span>
            <strong>↗</strong>
          </button>
        </div>
        <p className="entry-foot">THE SHARED TUBE IS VISIBLE TO BOTH</p>
      </div>
    </main>
  );
}

function Game({ role, onLeave }: { role: Player; onLeave: () => void }) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot>({
    levelId: firstLevel,
    game: { tubes: [], moves: 0, revision: 0, lastMove: null },
    history: [],
    revealed: { devansh: false, ridhima: false },
  });
  const [connected, setConnected] = useState(false);
  const [connectionText, setConnectionText] = useState("Connecting…");
  const [message, setMessage] = useState(
    "Tap one of your tubes, then tap your station or the shared tube.",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<{
    actor: Player;
    from: string;
    to: string;
  } | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [moving, setMoving] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [showLevels, setShowLevels] = useState(true);
  const [roomReady, setRoomReady] = useState(false);
  const [requestedLevel, setRequestedLevel] = useState<LevelId | null>(null);
  const room = useRef<Room | null>(null);
  const worker = useRef<Worker | null>(null);
  const revision = useRef("");
  const lastSeenRevision = useRef<string | null>(null);
  const state = snapshot.game;
  const level = getLevel(snapshot.levelId);
  revision.current = `${level.id}:${state.revision}`;
  const friend: Player = role === "devansh" ? "ridhima" : "devansh";
  const solved = state.tubes.length > 0 && isSolved(state);
  const legal = selected ? legalDestinations(state, role, selected) : [];

  useEffect(() => {
    const session = new Room(
      role,
      (next) => { setSnapshot(next); setRoomReady(true); },
      (ready, text) => {
        setConnected(ready);
        setConnectionText(text);
      },
      setMessage,
      (levelId) => {
        session.respondRestart(
          window.confirm(
            `${names[role === "devansh" ? "ridhima" : "devansh"]} wants to restart ${getLevel(levelId).name}. Restart together?`,
          ),
        );
      },
    );
    room.current = session;
    return () => {
      worker.current?.terminate();
      session.close();
      room.current = null;
    };
  }, [role]);

  useEffect(() => {
    if (!roomReady || !requestedLevel) return;
    if (requestedLevel !== snapshot.levelId) void room.current?.selectLevel(requestedLevel);
    setRequestedLevel(null);
  }, [roomReady, requestedLevel, snapshot.levelId]);

  useEffect(() => {
    const key = `${level.id}:${state.revision}`;
    if (lastSeenRevision.current === null) {
      lastSeenRevision.current = key;
      return;
    }
    if (lastSeenRevision.current === key) return;
    const changedLevel = !lastSeenRevision.current.startsWith(`${level.id}:`);
    lastSeenRevision.current = key;
    worker.current?.terminate();
    setThinking(false);
    setHint(null);
    setSelected(null);
    if (changedLevel) {
      setMessage(`${level.name} is ready. Work together through the shared tube.`);
    } else if (state.lastMove) {
      setMoving(state.lastMove.from);
      window.setTimeout(() => setMoving(null), 420);
      playCue(isSolved(state) ? "win" : "pour");
      setMessage(
        isSolved(state)
          ? `Perfectly sorted. ${level.name} complete!`
          : `${names[state.lastMove.actor]} poured ${state.lastMove.amount} ${state.lastMove.color} into ${state.lastMove.to}.`,
      );
    } else setMessage("The board was updated.");
  }, [state, level]);

  function tap(id: string) {
    startAudio();
    if (!connected || solved || moving) return;
    const tube = state.tubes.find((item) => item.id === id)!;
    if (selected === id) {
      setSelected(null);
      setMessage("Selection cleared. Pick a tube to pour from.");
      return;
    }
    if (!selected) {
      if (tube.owner !== role && tube.owner !== "shared") {
        playCue("invalid");
        setMessage(`${names[friend]}'s tubes are locked.`);
        return;
      }
      if (!tube.colors.length) {
        playCue("invalid");
        setMessage("Choose a tube that has paint in it.");
        return;
      }
      setSelected(id);
      setHint(null);
      setMessage("Now tap a glowing tube to pour.");
      playCue("select");
      return;
    }
    if (!legal.includes(id)) {
      playCue("invalid");
      setMessage("That pour is not allowed. Try a glowing tube.");
      return;
    }
    room.current?.move(selected, id);
    setSelected(null);
    setHint(null);
    setMessage("Pouring…");
  }

  function showHint() {
    startAudio();
    if (thinking || solved || !connected) return;
    setThinking(true);
    setMessage("Looking for a path from this board…");
    worker.current?.terminate();
    const nextWorker = new Worker(
      new URL("./solver.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = nextWorker;
    const requestKey = revision.current;
    nextWorker.onmessage = ({
      data,
    }: MessageEvent<{
      hint: { actor: Player; from: string; to: string } | null;
      stuck: boolean;
      limited: boolean;
      revision: number;
    }>) => {
      if (requestKey !== revision.current) return;
      setThinking(false);
      setHint(data.hint);
      setSelected(null);
      if (data.hint)
        setMessage(
          `${names[data.hint.actor]}: pour ${data.hint.from} into ${data.hint.to}.`,
        );
      else
        setMessage(
          data.limited ? "This path needs more thought. Try another pour or Undo." : data.stuck ? "This position is stuck. Try Undo." : "Level complete!",
        );
      nextWorker.terminate();
    };
    nextWorker.postMessage(state);
  }

  const renderTube = (tube: TubeData) => (
    <Tube
      key={tube.id}
      tube={tube}
      selected={selected === tube.id}
      legal={legal.includes(tube.id)}
      hinted={hint?.from === tube.id || hint?.to === tube.id}
      locked={tube.owner !== role && tube.owner !== "shared"}
      hidden={tube.owner === friend && !snapshot.revealed[friend]}
      moving={moving === tube.id}
      onClick={() => tap(tube.id)}
    />
  );

  return (
    <main className="game-shell">
      {showLevels && <div className="level-overlay" role="dialog" aria-modal="true" aria-label="Choose a level">
        <div className="level-card">
          <p className="eyebrow">ROOM {ROOM_CODE} · CHOOSE TOGETHER</p>
          <h2>Pick a <em>level.</em></h2>
          <p className="level-help">Either player can open a level. Your progress in each one is saved for this room.</p>
          <div className="level-grid">
            {levels.map((item, index) => <button
              key={item.id}
              type="button"
              onClick={() => {
                setShowLevels(false);
                setRequestedLevel(item.id as LevelId);
              }}
              className={item.id === snapshot.levelId ? "active" : ""}
            >
              <span className="level-number">{String(index + 1).padStart(2, "0")}</span>
              <span><b>{item.name}</b><small>{item.tier} · {item.moves} moves</small></span>
              <strong>↗</strong>
            </button>)}
          </div>
          {!roomReady && <p className="level-help" role="status">{connectionText}</p>}
          <button className="level-close" type="button" onClick={() => setShowLevels(false)}>Continue current level</button>
          {!roomReady && <button className="level-close" type="button" onClick={() => { if (room.current) void room.current.leave().finally(onLeave); else onLeave(); }}>Change player</button>}
        </div>
      </div>}
      <div className="game-wrap">
        <header className="topbar">
          <Brand />
          <div className="top-actions">
            <button className="level-open" type="button" onClick={() => setShowLevels(true)}>LEVELS</button>
            <span className={`level-pill${connected ? " online" : ""}`}>
              <span /> {connected ? "CONNECTED" : "WAITING"}
            </span>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                const next = toggleMute();
                setMuted(next);
                playCue("select");
              }}
              aria-label={muted ? "Turn sound on" : "Mute sound"}
              title={muted ? "Turn sound on" : "Mute sound"}
            >
              {muted ? "♪̸" : "♫"}
            </button>
          </div>
        </header>
        <section className="intro">
          <div>
            <p className="eyebrow">LEVEL {level.id.slice(-2)} · {level.name.toUpperCase()}</p>
            <h1>
              Make room for <em>color.</em>
            </h1>
          </div>
          <p className="intro-side">
            A little sorting puzzle for two.
            <br />
            Pass paint through the middle.
          </p>
        </section>
        <div className="board">
          <section className="station own" aria-label="Your station">
            <div className="station-heading">
              <div>
                <span className="station-dot" />
                <span className="station-name">Your station</span>
                <small>{names[role]}</small>
              </div>
              <button
                className="reveal-button"
                type="button"
                disabled={!connected}
                onClick={() =>
                  room.current?.setReveal(!snapshot.revealed[role])
                }
              >
                {snapshot.revealed[role] ? "HIDE MINE" : "REVEAL MINE"}
              </button>
            </div>
            <div className={`tube-row${state.tubes.filter(tube => tube.owner === role).length === 4 ? " four" : ""}`}>
              {state.tubes
                .filter((tube) => tube.owner === role)
                .map(renderTube)}
            </div>
          </section>
          <section className="bridge" aria-label="Shared tube">
            <div className="bridge-line">
              <span>THE BRIDGE</span>
            </div>
            <div className="bridge-content">
              <p>
                Pass colors
                <br />
                through here <span>↗</span>
              </p>
              {state.tubes.find((tube) => tube.owner === "shared") &&
                renderTube(
                  state.tubes.find((tube) => tube.owner === "shared")!,
                )}
              <p className="bridge-note">
                Both players
                <br />
                can see this tube.
              </p>
            </div>
          </section>
          <section className="station friend" aria-label="Friend's station">
            <div className="station-heading">
              <div>
                <span className="station-dot" />
                <span className="station-name">Friend's station</span>
                <small>{names[friend]}</small>
              </div>
              <span className="station-tag">
                {snapshot.revealed[friend] ? "REVEALED" : "HIDDEN"}
              </span>
            </div>
            <div className={`tube-row${state.tubes.filter(tube => tube.owner === friend).length === 4 ? " four" : ""}`}>
              {state.tubes
                .filter((tube) => tube.owner === friend)
                .map(renderTube)}
            </div>
          </section>
        </div>
        <div className="play-footer">
          <div className="status">
            <span className={`status-spark${solved ? " won" : ""}`}>
              {solved ? "✦" : "◌"}
            </span>
            <p role="status">{connected ? message : connectionText}</p>
          </div>
          <div className="controls">
            <button
              type="button"
              onClick={() => {
                room.current?.undo();
                setMessage("Undo requested…");
              }}
              disabled={
                !connected ||
                snapshot.history.length === 0 ||
                state.lastMove?.actor !== role
              }
            >
              ↶ <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={!connected || thinking || solved}
            >
              ✧ <span>{thinking ? "Thinking" : "Hint"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                room.current?.requestRestart();
                setMessage("Waiting for your friend to confirm restart…");
              }}
              disabled={!connected}
            >
              ⟳ <span>Restart</span>
            </button>
          </div>
        </div>
        <footer className="bottom-line">
          <div className="room-label">
            <span>ROOM {ROOM_CODE}</span>
            <b>{names[role]}</b>
            <button type="button" onClick={() => { if (room.current) void room.current.leave().finally(onLeave); else onLeave() }}>
              Change player
            </button>
          </div>
          <span className="move-count">
            {String(state.moves).padStart(2, "0")} MOVES
          </span>
        </footer>
      </div>
    </main>
  );
}

export default function App() {
  const [entered, setEntered] = useState(false);
  const [role, setRole] = useState<Player | null>(null);
  if (!entered) return <Entry onEnter={() => setEntered(true)} />;
  if (!role) return <SeatPicker onChoose={setRole} />;
  return <Game role={role} onLeave={() => setRole(null)} />;
}
