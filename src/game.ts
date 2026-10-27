export type Player = "devansh" | "ridhima";
export type Color = "rose" | "blue" | "gold" | "mint" | "lilac" | "peach" | "teal";
export type Tube = { id: string; owner: Player | "shared"; colors: Color[] };
export type Move = {
  actor: Player;
  from: string;
  to: string;
  color: Color;
  amount: number;
};
export type GameState = {
  tubes: Tube[];
  moves: number;
  revision: number;
  lastMove: Move | null;
};
export type MoveResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

export const capacity = 4;

const colorKey: Record<string, Color> = {
  a: "rose", b: "blue", c: "gold", d: "mint",
  e: "lilac", f: "peach", g: "teal",
};

export const levels = [
  { id: "level-01", name: "One color at a time", tier: "First steps", moves: 13, devansh: ["abca", ""], riddsss: ["bcab", ""], shared: "cabc" },
  { id: "level-02", name: "Crossing paths", tier: "A little further", moves: 20, devansh: ["cccd", "bdea", "eaad"], riddsss: ["ecba", "bebd", ""], shared: "" },
  { id: "level-03", name: "Color current", tier: "A little further", moves: 22, devansh: ["cecb", "dcbe", "daac"], riddsss: ["aede", "dabb", ""], shared: "" },
  { id: "level-04", name: "The long way round", tier: "A little further", moves: 26, devansh: ["dbdb", "edca", "acea"], riddsss: ["deab", "cecb", ""], shared: "" },
  { id: "level-05", name: "Tangled threads", tier: "A real puzzle", moves: 30, devansh: ["abde", "bfab", "fcea", "dfeb"], riddsss: ["ccda", "defc", ""], shared: "" },
  { id: "level-06", name: "Final spectrum", tier: "A real puzzle", moves: 38, devansh: ["ecgd", "dbfb", "fcga", "gdce"], riddsss: ["dgfb", "efea", "caba", ""], shared: "" },
] as const;

export type LevelId = (typeof levels)[number]["id"];
export const firstLevel: LevelId = "level-01";
export function getLevel(id: string) { return levels.find(level => level.id === id) ?? levels[0]; }

export const initialState = (levelId: LevelId = firstLevel): GameState => ({
  tubes: (() => {
    const level = getLevel(levelId);
    const makeTube = (id: string, owner: Tube["owner"], pattern: string): Tube => ({
      id, owner, colors: [...pattern].map(letter => colorKey[letter]),
    });
    return [
      ...level.devansh.map((pattern, index) => makeTube(`D${index + 1}`, "devansh", pattern)),
      ...level.riddsss.map((pattern, index) => makeTube(`R${index + 1}`, "ridhima", pattern)),
      makeTube("S", "shared", level.shared),
    ];
  })(),
  moves: 0,
  revision: 0,
  lastMove: null,
});

export function applyMove(
  state: GameState,
  actor: Player,
  fromId: string,
  toId: string,
): MoveResult {
  const from = state.tubes.find((tube) => tube.id === fromId);
  const to = state.tubes.find((tube) => tube.id === toId);
  if (!from || !to || from === to)
    return { ok: false, reason: "Choose two different tubes." };
  if (
    (from.owner !== actor && from.owner !== "shared") ||
    (to.owner !== actor && to.owner !== "shared")
  ) {
    return { ok: false, reason: "That tube belongs to your friend." };
  }
  if (!from.colors.length) return { ok: false, reason: "That tube is empty." };
  if (to.colors.length === capacity)
    return { ok: false, reason: "That tube is full." };
  const color = from.colors[from.colors.length - 1];
  if (to.colors.length && to.colors[to.colors.length - 1] !== color) {
    return { ok: false, reason: "Colors must match to pour." };
  }
  let run = 0;
  while (
    run < from.colors.length &&
    from.colors[from.colors.length - 1 - run] === color
  )
    run++;
  const amount = Math.min(run, capacity - to.colors.length);
  const tubes = state.tubes.map((tube) => {
    if (tube.id === fromId)
      return { ...tube, colors: tube.colors.slice(0, -amount) };
    if (tube.id === toId)
      return {
        ...tube,
        colors: [...tube.colors, ...Array<Color>(amount).fill(color)],
      };
    return tube;
  });
  return {
    ok: true,
    state: {
      tubes,
      moves: state.moves + 1,
      revision: state.revision + 1,
      lastMove: { actor, from: fromId, to: toId, color, amount },
    },
  };
}

export function legalDestinations(
  state: GameState,
  actor: Player,
  fromId: string,
): string[] {
  return state.tubes
    .filter((tube) => applyMove(state, actor, fromId, tube.id).ok)
    .map((tube) => tube.id);
}

export function isSolved(state: GameState): boolean {
  return state.tubes.every((tube) =>
    tube.owner === "shared"
      ? tube.colors.length === 0
      : tube.colors.length === 0 ||
        (tube.colors.length === capacity &&
          tube.colors.every((color) => color === tube.colors[0])),
  );
}
