import { useEffect, useRef, useState } from "react";
import {
  applyMove,
  initialState,
  isSolved,
  legalDestinations,
  type Color,
  type GameState,
  type Player,
  type Tube as TubeData,
} from "./game";
import { isMuted, playCue, startAudio, toggleMute } from "./audio";

const names: Record<Player, string> = {
  devansh: "Devansh",
  ridhima: "Ridhima",
};
const paint: Record<Color, string> = {
  rose: "#efa2aa",
  blue: "#a9c9ee",
  gold: "#f1d999",
};

function Tube({
  tube,
  selected,
  legal,
  hinted,
  locked,
  moving,
  onClick,
}: {
  tube: TubeData;
  selected: boolean;
  legal: boolean;
  hinted: boolean;
  locked: boolean;
  moving: boolean;
  onClick: () => void;
}) {
  const clip = `clip-${tube.id}`;
  return (
    <button
      className={`tube-button${selected ? " selected" : ""}${legal ? " legal" : ""}${hinted ? " hinted" : ""}${locked ? " locked" : ""}${moving ? " moving" : ""}`}
      onClick={onClick}
      aria-label={`${tube.id}, ${tube.colors.length ? tube.colors.join(", ") : "empty"}${locked ? ", friend’s tube" : ""}`}
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
              fill={paint[color]}
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

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [history, setHistory] = useState<GameState[]>([]);
  const [role, setRole] = useState<Player>("devansh");
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<{
    actor: Player;
    from: string;
    to: string;
  } | null>(null);
  const [message, setMessage] = useState(
    "Tap one of your tubes, then tap your station or the shared tube.",
  );
  const [muted, setMuted] = useState(isMuted);
  const [moving, setMoving] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const worker = useRef<Worker | null>(null);
  const revision = useRef(state.revision);
  revision.current = state.revision;

  useEffect(() => () => worker.current?.terminate(), []);

  const solved = isSolved(state);
  const friend: Player = role === "devansh" ? "ridhima" : "devansh";
  const legal = selected ? legalDestinations(state, role, selected) : [];

  function clearHintSearch() {
    worker.current?.terminate();
    worker.current = null;
    setThinking(false);
  }

  function tap(id: string) {
    startAudio();
    if (solved || moving) return;
    const tube = state.tubes.find((item) => item.id === id)!;
    if (selected === id) {
      setSelected(null);
      setMessage("Selection cleared. Pick a tube to pour from.");
      return;
    }
    if (!selected) {
      if (tube.owner !== role && tube.owner !== "shared") {
        playCue("invalid");
        setMessage(
          `${names[friend]}'s tubes are locked. Switch player to use them.`,
        );
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
    const result = applyMove(state, role, selected, id);
    if (!result.ok) {
      playCue("invalid");
      setMessage(result.reason);
      return;
    }
    clearHintSearch();
    setHistory([...history, state]);
    setState(result.state);
    setSelected(null);
    setHint(null);
    setMoving(selected);
    window.setTimeout(() => setMoving(null), 420);
    playCue(isSolved(result.state) ? "win" : "pour");
    setMessage(
      isSolved(result.state)
        ? "Perfectly sorted. Level 1 complete!"
        : `${result.state.lastMove!.amount} ${result.state.lastMove!.color} poured into ${id}.`,
    );
  }

  function chooseRole(next: Player) {
    startAudio();
    setRole(next);
    setSelected(null);
    setHint(null);
    setMessage(`Playing as ${names[next]}. Your station is on top.`);
    playCue("select");
  }

  function undo() {
    if (!history.length) return;
    startAudio();
    clearHintSearch();
    setState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setSelected(null);
    setHint(null);
    setMessage("Last pour undone.");
    playCue("select");
  }

  function restart() {
    if (!window.confirm("Start Level 1 over?")) return;
    clearHintSearch();
    setState(initialState());
    setHistory([]);
    setSelected(null);
    setHint(null);
    setMessage("Fresh start. Choose a tube to begin.");
    playCue("select");
  }

  function showHint() {
    startAudio();
    if (thinking || solved) return;
    setThinking(true);
    setMessage("Looking for a path from this board…");
    worker.current?.terminate();
    const nextWorker = new Worker(
      new URL("./solver.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = nextWorker;
    nextWorker.onmessage = ({
      data,
    }: MessageEvent<{
      hint: { actor: Player; from: string; to: string } | null;
      stuck: boolean;
      revision: number;
    }>) => {
      if (data.revision !== revision.current) return;
      setThinking(false);
      setHint(data.hint);
      setSelected(null);
      if (data.hint)
        setMessage(
          `${names[data.hint.actor]}: pour ${data.hint.from} into ${data.hint.to}.`,
        );
      else
        setMessage(
          data.stuck ? "This position is stuck. Try Undo." : "Level complete!",
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
      moving={moving === tube.id}
      onClick={() => tap(tube.id)}
    />
  );

  return (
    <main className="game-shell">
      <div className="game-wrap">
        <header className="topbar">
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
          <div className="top-actions">
            <span className="level-pill">
              <span /> LEVEL 01
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
            <p className="eyebrow">ONE COLOR AT A TIME</p>
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
              <span className="station-tag">ACTIVE</span>
            </div>
            <div className="tube-row">
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
              {renderTube(state.tubes.find((tube) => tube.owner === "shared")!)}
              <p className="bridge-note">
                Both players
                <br />
                can use this tube.
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
              <span className="station-tag">LOCKED</span>
            </div>
            <div className="tube-row">
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
            <p role="status">{message}</p>
          </div>
          <div className="controls">
            <button type="button" onClick={undo} disabled={!history.length}>
              ↶ <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={thinking || solved}
            >
              ✧ <span>{thinking ? "Thinking" : "Hint"}</span>
            </button>
            <button type="button" onClick={restart}>
              ⟳ <span>Restart</span>
            </button>
          </div>
        </div>

        <footer className="bottom-line">
          <div className="role-switch">
            <span>PLAY AS</span>
            <button
              className={role === "devansh" ? "current" : ""}
              onClick={() => chooseRole("devansh")}
              type="button"
            >
              Devansh
            </button>
            <button
              className={role === "ridhima" ? "current" : ""}
              onClick={() => chooseRole("ridhima")}
              type="button"
            >
              Ridhima
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
