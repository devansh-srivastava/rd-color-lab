import { applyMove, isSolved, type GameState, type Player } from "./game";

type Hint = { actor: Player; from: string; to: string };
type Node = { state: GameState; first: Hint | null; steps: number; score: number };
const players: Player[] = ["devansh", "ridhima"];
const limit = 60000;

function key(state: GameState) {
  const colors = (owner: Player | "shared") => state.tubes
    .filter(tube => tube.owner === owner)
    .map(tube => tube.colors.join(""))
    .sort()
    .join("|");
  return `${colors("devansh")}/${colors("ridhima")}/${colors("shared")}`;
}

function distance(state: GameState) {
  const blocks = state.tubes.reduce((total, tube) => total + tube.colors.reduce(
    (count, color, index) => count + (index === 0 || color !== tube.colors[index - 1] ? 1 : 0), 0,
  ), 0);
  const colors = new Set(state.tubes.flatMap(tube => tube.colors)).size;
  return Math.max(0, blocks - colors);
}

function push(heap: Node[], item: Node) {
  heap.push(item);
  let index = heap.length - 1;
  while (index) {
    const parent = (index - 1) >> 1;
    if (heap[parent].score <= item.score) break;
    heap[index] = heap[parent];
    index = parent;
  }
  heap[index] = item;
}

function pop(heap: Node[]) {
  const first = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].score < heap[child].score) child++;
      if (heap[child].score >= last.score) break;
      heap[index] = heap[child];
      index = child;
    }
    heap[index] = last;
  }
  return first;
}

self.onmessage = ({ data }: MessageEvent<GameState>) => {
  const heap: Node[] = [];
  const seen = new Map<string, number>([[key(data), 0]]);
  push(heap, { state: data, first: null, steps: 0, score: distance(data) });
  while (heap.length && seen.size < limit) {
    const current = pop(heap);
    if (current.steps !== seen.get(key(current.state))) continue;
    if (isSolved(current.state)) {
      self.postMessage({ hint: current.first, stuck: false, limited: false, revision: data.revision });
      return;
    }
    for (const actor of players)
      for (const from of current.state.tubes)
        for (const to of current.state.tubes) {
          const result = applyMove(current.state, actor, from.id, to.id);
          if (!result.ok) continue;
          const nextKey = key(result.state);
          const steps = current.steps + 1;
          if (steps >= (seen.get(nextKey) ?? Infinity)) continue;
          seen.set(nextKey, steps);
          push(heap, {
            state: result.state,
            first: current.first ?? { actor, from: from.id, to: to.id },
            steps,
            score: steps + distance(result.state),
          });
        }
  }
  self.postMessage({ hint: null, stuck: heap.length === 0, limited: heap.length > 0, revision: data.revision });
};
