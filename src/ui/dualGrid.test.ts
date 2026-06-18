import { describe, it, expect } from "vitest";
import { cellShapes, MS_CASES, type CornerSample } from "./dualGrid";

const c = (layer: number, color: string): CornerSample => ({ layer, color });

describe("dual-grid cellShapes", () => {
  it("a uniform cell draws a single full-cell fill", () => {
    const s = cellShapes(c(3, "#land"), c(3, "#land"), c(3, "#land"), c(3, "#land"));
    expect(s).toHaveLength(1);
    expect(s[0].color).toBe("#land");
    expect(s[0].points).toEqual(MS_CASES[15][0]); // full square
  });

  it("base fill is always the lowest corner's color", () => {
    const s = cellShapes(c(5, "#peak"), c(3, "#plain"), c(0, "#sea"), c(2, "#coast"));
    expect(s[0].color).toBe("#sea");
    expect(s[0].points).toEqual(MS_CASES[15][0]);
  });

  it("one ocean corner among land cuts a diagonal coast band", () => {
    // NW/NE/SE land (layer 3), SW ocean (layer 0): land is the 'all but SW' case.
    const s = cellShapes(c(3, "#land"), c(3, "#land"), c(3, "#land"), c(0, "#sea"));
    expect(s).toHaveLength(2);
    expect(s[0].color).toBe("#sea"); // base
    expect(s[1].color).toBe("#land");
    expect(s[1].points).toEqual(MS_CASES[14][0]); // mask 1110 = all but SW
  });

  it("opposite corners high produce a saddle (two triangles) over one base", () => {
    const s = cellShapes(c(3, "#land"), c(0, "#sea"), c(3, "#land"), c(0, "#sea"));
    // mask 1010 = 10 → saddle, two triangles, both land, over the sea base.
    expect(s).toHaveLength(3);
    expect(s[0].color).toBe("#sea");
    expect(s[1].color).toBe("#land");
    expect(s[2].color).toBe("#land");
    expect(MS_CASES[10]).toHaveLength(2);
  });

  it("stacks nested isobands low-to-high so the highest paints last", () => {
    // sea(0) NW, plain(3) NE, peak(5) SE+SW.
    const s = cellShapes(c(0, "#sea"), c(3, "#plain"), c(5, "#peak"), c(5, "#peak"));
    expect(s.map((x) => x.color)).toEqual(["#sea", "#plain", "#peak"]);
    // plain threshold v=3 → mask 0111 (all but NW) = 7
    expect(s[1].points).toEqual(MS_CASES[7][0]);
    // peak threshold v=5 → SE+SW in = mask 0011 (south band) = 3
    expect(s[2].points).toEqual(MS_CASES[3][0]);
  });
});
