export type Player = "devansh" | "ridhima";
export type Color = "rose" | "blue" | "gold";
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

export const initialState = (): GameState => ({
  tubes: [
    { id: "D1", owner: "devansh", colors: ["rose", "blue", "gold", "rose"] },
    { id: "D2", owner: "devansh", colors: [] },
    { id: "R1", owner: "ridhima", colors: ["blue", "gold", "rose", "blue"] },
    { id: "R2", owner: "ridhima", colors: [] },
    { id: "S", owner: "shared", colors: ["gold", "rose", "blue", "gold"] },
  ],
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
