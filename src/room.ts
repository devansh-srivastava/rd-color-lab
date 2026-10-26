import Peer, { type DataConnection } from "peerjs";
import { applyMove, initialState, type GameState, type Player } from "./game";

export const ROOM_CODE = "112211";
const HOST_ID = "rd-color-lab-112211-devansh-v1";
const SAVE_KEY = "rd-color-lab-room-112211";

export type RoomSnapshot = {
  game: GameState;
  history: GameState[];
  revealed: Record<Player, boolean>;
};

type Command =
  | { type: "move"; from: string; to: string }
  | { type: "undo" }
  | { type: "reveal"; value: boolean }
  | { type: "restart-request" }
  | { type: "restart-reply"; accepted: boolean };

type Packet =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "notice"; text: string }
  | { type: "restart-request" };

const freshRoom = (): RoomSnapshot => ({
  game: initialState(),
  history: [],
  revealed: { devansh: false, ridhima: false },
});

function savedRoom(): RoomSnapshot {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const value = JSON.parse(saved) as RoomSnapshot;
      if (value.game?.tubes?.length === 5 && value.revealed) return value;
    }
  } catch {
    /* Start a new room if local storage is unavailable. */
  }
  return freshRoom();
}

export class Room {
  private peer: Peer;
  private connection: DataConnection | null = null;
  private retry: number | null = null;
  private pendingSince = 0;
  private snapshot: RoomSnapshot;
  private pendingRestart = false;
  private closed = false;

  constructor(
    readonly role: Player,
    private readonly onSnapshot: (snapshot: RoomSnapshot) => void,
    private readonly onStatus: (connected: boolean, text: string) => void,
    private readonly onNotice: (text: string) => void,
    private readonly onRestartRequest: () => void,
  ) {
    this.snapshot = role === "devansh" ? savedRoom() : freshRoom();
    this.onSnapshot(this.snapshot);
    this.peer = role === "devansh" ? new Peer(HOST_ID) : new Peer();
    this.peer.on("open", () => {
      if (role === "devansh")
        this.onStatus(false, "Waiting for Ridhima to join…");
      else {
        this.onStatus(false, "Looking for Devansh…");
        this.connectToHost();
        this.retry = window.setInterval(() => this.connectToHost(), 4000);
      }
    });
    this.peer.on("connection", (connection) => {
      if (role !== "devansh" || this.connection?.open) {
        connection.close();
        return;
      }
      this.attach(connection);
    });
    this.peer.on("disconnected", () => {
      if (!this.connection?.open)
        this.onStatus(false, "Connection lost. Reconnecting…");
      if (!this.closed)
        window.setTimeout(() => {
          if (this.peer.disconnected && !this.peer.destroyed)
            this.peer.reconnect();
        }, 1500);
    });
    this.peer.on("error", (error) => {
      if (error.type === "peer-unavailable" && role === "ridhima") {
        this.pendingSince = 0;
        return;
      }
      if (error.type === "unavailable-id")
        this.onStatus(
          false,
          "Devansh is already in this room. Choose Ridhima on this phone.",
        );
      else
        this.onStatus(
          false,
          "Could not connect. Check your internet and try again.",
        );
    });
  }

  private connectToHost() {
    if (this.closed || this.role !== "ridhima" || this.connection?.open) return;
    if (this.connection && Date.now() - this.pendingSince < 12000) return;
    this.connection?.close();
    this.pendingSince = Date.now();
    this.attach(
      this.peer.connect(HOST_ID, { serialization: "json", reliable: true }),
    );
  }

  private attach(connection: DataConnection) {
    this.connection = connection;
    connection.on("open", () => {
      if (this.connection !== connection) return;
      this.onStatus(true, "Connected");
      this.pendingSince = 0;
      if (this.role === "devansh")
        connection.send({
          type: "snapshot",
          snapshot: this.snapshot,
        } satisfies Packet);
    });
    connection.on("data", (data) => {
      if (this.connection !== connection) return;
      if (this.role === "devansh") this.handleCommand(data as Command);
      else this.handlePacket(data as Packet);
    });
    connection.on("close", () => {
      if (this.connection !== connection) return;
      this.connection = null;
      this.pendingSince = 0;
      this.pendingRestart = false;
      this.onStatus(
        false,
        this.role === "devansh"
          ? "Ridhima disconnected. Waiting for her…"
          : "Devansh disconnected. Reconnecting…",
      );
    });
    connection.on("error", () => {
      if (this.connection === connection)
        this.onStatus(false, "Connection interrupted. Reconnecting…");
    });
  }

  private handlePacket(packet: Packet) {
    if (!packet || typeof packet !== "object") return;
    if (packet.type === "snapshot") {
      this.snapshot = packet.snapshot;
      this.onSnapshot(packet.snapshot);
    } else if (packet.type === "notice") this.onNotice(packet.text);
    else if (packet.type === "restart-request") this.onRestartRequest();
  }

  private handleCommand(command: Command) {
    if (!command || typeof command !== "object") return;
    if (command.type === "move")
      this.moveAs("ridhima", command.from, command.to);
    else if (command.type === "undo") this.undoAs("ridhima");
    else if (command.type === "reveal") this.revealAs("ridhima", command.value);
    else if (command.type === "restart-request") this.onRestartRequest();
    else if (command.type === "restart-reply") {
      if (this.pendingRestart && command.accepted) this.commit(freshRoom());
      this.pendingRestart = false;
      if (!command.accepted) this.onNotice("Ridhima kept the current game.");
    }
  }

  private commit(snapshot: RoomSnapshot) {
    this.snapshot = snapshot;
    this.onSnapshot(snapshot);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Gameplay still works without persistence. */
    }
    if (this.connection?.open)
      this.connection.send({ type: "snapshot", snapshot } satisfies Packet);
  }

  private tell(text: string) {
    this.onNotice(text);
    if (this.connection?.open)
      this.connection.send({ type: "notice", text } satisfies Packet);
  }

  private moveAs(actor: Player, from: string, to: string) {
    const result = applyMove(this.snapshot.game, actor, from, to);
    if (!result.ok) {
      this.tell(result.reason);
      return;
    }
    this.commit({
      ...this.snapshot,
      game: result.state,
      history: [...this.snapshot.history, this.snapshot.game],
    });
  }

  move(from: string, to: string) {
    if (!this.connection?.open) return;
    if (this.role === "devansh") this.moveAs("devansh", from, to);
    else this.connection.send({ type: "move", from, to } satisfies Command);
  }

  private undoAs(actor: Player) {
    const previous = this.snapshot.history.at(-1);
    if (!previous || this.snapshot.game.lastMove?.actor !== actor) return;
    this.commit({
      ...this.snapshot,
      game: {
        ...previous,
        revision: this.snapshot.game.revision + 1,
        lastMove: null,
      },
      history: this.snapshot.history.slice(0, -1),
    });
    this.tell("Last pour undone.");
  }

  undo() {
    if (!this.connection?.open) return;
    if (this.role === "devansh") this.undoAs("devansh");
    else this.connection.send({ type: "undo" } satisfies Command);
  }

  private revealAs(actor: Player, value: boolean) {
    this.commit({
      ...this.snapshot,
      revealed: { ...this.snapshot.revealed, [actor]: value },
    });
  }

  setReveal(value: boolean) {
    if (!this.connection?.open) return;
    if (this.role === "devansh") this.revealAs("devansh", value);
    else this.connection.send({ type: "reveal", value } satisfies Command);
  }

  requestRestart() {
    if (!this.connection?.open) return;
    if (this.role === "devansh") {
      this.pendingRestart = true;
      this.connection.send({ type: "restart-request" } satisfies Packet);
    } else this.connection.send({ type: "restart-request" } satisfies Command);
  }

  respondRestart(accepted: boolean) {
    if (this.role === "devansh") {
      if (accepted) this.commit(freshRoom());
      else this.tell("Devansh kept the current game.");
    } else if (this.connection?.open)
      this.connection.send({
        type: "restart-reply",
        accepted,
      } satisfies Command);
  }

  close() {
    this.closed = true;
    if (this.retry !== null) window.clearInterval(this.retry);
    this.connection?.close();
    this.peer.destroy();
  }
}
