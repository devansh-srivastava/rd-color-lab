import { describe, expect, it } from "vitest";
import { applyMove, initialState, isSolved, type Player } from "./game";

describe("Level 1 rules", () => {
  it("replays the verified 13-move solution to a win", () => {
    let state = initialState();
    const steps: [Player, string, string][] = [
      ["devansh", "D1", "D2"],
      ["devansh", "S", "D1"],
      ["ridhima", "R1", "S"],
      ["ridhima", "S", "R2"],
      ["ridhima", "R1", "S"],
      ["devansh", "S", "D2"],
      ["devansh", "D1", "S"],
      ["ridhima", "R1", "S"],
      ["ridhima", "R1", "R2"],
      ["ridhima", "S", "R1"],
      ["devansh", "D1", "S"],
      ["devansh", "D1", "D2"],
      ["ridhima", "S", "R2"],
    ];
    for (const [actor, from, to] of steps) {
      const before = state.tubes.flatMap((tube) => tube.colors).sort();
      const result = applyMove(state, actor, from, to);
      expect(result.ok, `${actor}: ${from} → ${to}`).toBe(true);
      if (!result.ok) return;
      state = result.state;
      expect(state.tubes.flatMap((tube) => tube.colors).sort()).toEqual(before);
    }
    expect(state.moves).toBe(13);
    expect(isSolved(state)).toBe(true);
  });

  it("enforces ownership, matching colors, and maximal runs", () => {
    const start = initialState();
    expect(applyMove(start, "devansh", "R1", "S").ok).toBe(false);
    expect(applyMove(start, "devansh", "D1", "S").ok).toBe(false);
    const first = applyMove(start, "devansh", "D1", "D2");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.tubes.find((tube) => tube.id === "D2")?.colors).toEqual([
      "rose",
    ]);
    expect(start.tubes.find((tube) => tube.id === "D2")?.colors).toEqual([]);
  });
});
