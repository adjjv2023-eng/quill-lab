import { describe, expect, it } from "vitest";
import {
  appendTrailPoint,
  clamp,
  createOrbiters,
  createSpore,
  createTrail,
  hashText,
  oracleFor,
  paletteFor,
  titleFor,
} from "../src/garden";

describe("garden primitives", () => {
  it("hashes text deterministically", () => {
    expect(hashText("moon root")).toBe(hashText("moon root"));
    expect(hashText("moon root")).not.toBe(hashText("ember field"));
  });

  it("generates a palette from the seed and mode", () => {
    const palette = paletteFor("moon root", "nebula", 72);
    expect(palette.baseHue).toBeGreaterThanOrEqual(0);
    expect(palette.baseHue).toBeLessThan(360);
    expect(palette.accentHue).not.toBe(palette.coreHue);
  });

  it("creates a variable number of orbiters", () => {
    const orbiters = createOrbiters("glass pollen", {
      seed: "glass pollen",
      mode: "reef",
      bloom: 80,
      drift: 36,
      gravity: 24,
      chroma: 70,
      pulse: 52,
    });
    expect(orbiters.length).toBeGreaterThan(20);
  });

  it("creates a spore with a bounded life and radius", () => {
    const spore = createSpore(10, 20, "moon root", 0.5);
    expect(spore.x).toBe(10);
    expect(spore.radius).toBeGreaterThan(0);
    expect(spore.life).toBe(1);
  });

  it("creates and extends a trail", () => {
    const trail = createTrail(1, 2, "glass pollen", 0.6);
    expect(trail.points).toHaveLength(1);
    appendTrailPoint(trail, 3, 4, 0.5);
    expect(trail.points).toHaveLength(2);
    expect(trail.points[1]).toMatchObject({ x: 3, y: 4 });
  });

  it("produces different oracle text by mode", () => {
    expect(oracleFor("moon root", "nebula")).not.toBe(
      oracleFor("moon root", "ember"),
    );
  });

  it("clamps values", () => {
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(15, 10, 20)).toBe(15);
    expect(clamp(25, 10, 20)).toBe(20);
  });

  it("builds a title from the seed", () => {
    expect(titleFor("moon root")).toMatch(/ /);
  });
});
