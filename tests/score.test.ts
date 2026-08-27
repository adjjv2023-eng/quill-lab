import { describe, expect, it } from "vitest";
import { scoreResults, severityValue, gradeFor } from "../src/score.js";
import type { RuleResult } from "../src/types.js";

const rule = (
  id: string,
  weight: number,
  severity: RuleResult["severity"],
): RuleResult => ({
  id,
  title: id,
  weight,
  severity,
  detail: "",
});

describe("score engine", () => {
  it("returns 100 when everything passes", () => {
    const rules: RuleResult[] = [rule("a", 10, "ok"), rule("b", 5, "ok")];
    expect(scoreResults(rules)).toBe(100);
  });

  it("returns 0 when everything fails", () => {
    const rules: RuleResult[] = [rule("a", 10, "fail")];
    expect(scoreResults(rules)).toBe(0);
  });

  it("weights pass/fail proportionally", () => {
    const rules: RuleResult[] = [
      rule("pass", 60, "ok"),
      rule("fail", 40, "fail"),
    ];
    expect(scoreResults(rules)).toBe(60);
  });

  it("gives warnings half credit", () => {
    const rules: RuleResult[] = [rule("warn", 100, "warn")];
    expect(scoreResults(rules)).toBe(50);
  });

  it("handles an empty rule set", () => {
    expect(scoreResults([])).toBe(0);
  });
});

describe("severity weights", () => {
  it("maps each severity", () => {
    expect(severityValue("ok")).toBe(1);
    expect(severityValue("warn")).toBe(0.5);
    expect(severityValue("fail")).toBe(0);
  });
});

describe("grading", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    [89, "B"],
    [75, "B"],
    [74, "C"],
    [60, "C"],
    [59, "D"],
    [45, "D"],
    [44, "F"],
    [0, "F"],
  ] as const)("gradeFor(%i) = %s", (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});
