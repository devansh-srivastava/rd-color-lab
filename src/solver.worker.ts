import { applyMove, isSolved, type GameState, type Player } from "./game";

type Hint = { actor: Player; from: string; to: string };
const players: Player[] = ["devansh", "ridhima"];
const key = (state: GameState) =>
  state.tubes.map((tube) => tube.colors.join(",")).join("|");

self.onmessage = ({ data }: MessageEvent<GameState>) => {
  const seen = new Set<string>([key(data)]);
  const queue: { state: GameState; first: Hint | null }[] = [
    { state: data, first: null },
  ];
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (isSolved(current.state)) {
      self.postMessage({
        hint: current.first,
        stuck: false,
        revision: data.revision,
      });
      return;
    }
    for (const actor of players)
      for (const from of current.state.tubes)
        for (const to of current.state.tubes) {
          const result = applyMove(current.state, actor, from.id, to.id);
          if (!result.ok) continue;
          const nextKey = key(result.state);
          if (seen.has(nextKey)) continue;
          seen.add(nextKey);
          queue.push({
            state: result.state,
            first: current.first ?? { actor, from: from.id, to: to.id },
          });
        }
  }
  self.postMessage({ hint: null, stuck: true, revision: data.revision });
};
