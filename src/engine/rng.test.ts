import { describe, it, expect } from "vitest";
import { Rng, hashSeed } from "./rng";

describe("Rng", () => {
  it("is deterministic: same seed yields the same sequence", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("different seeds diverge", () => {
    const a = Array.from({ length: 8 }, ((r) => () => r.next())(new Rng(1)));
    const b = Array.from({ length: 8 }, ((r) => () => r.next())(new Rng(2)));
    expect(a).not.toEqual(b);
  });

  it("next() stays in [0, 1)", () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() respects inclusive bounds", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it("pick throws on an empty array", () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it("state can be saved and restored to reproduce the stream", () => {
    const r = new Rng(123);
    r.next();
    r.next();
    const state = r.getState();
    const after = [r.next(), r.next(), r.next()];
    const r2 = new Rng(0);
    r2.setState(state);
    expect([r2.next(), r2.next(), r2.next()]).toEqual(after);
  });

  it("hashSeed is stable and order-sensitive", () => {
    expect(hashSeed("orbis")).toBe(hashSeed("orbis"));
    expect(hashSeed("ab")).not.toBe(hashSeed("ba"));
  });
});
