import type { Grade, RuleResult, Severity, Snapshot } from "./types.js";
import { RULES } from "./rules.js";

export function auditRules(snapshot: Snapshot): RuleResult[] {
  const names = new Set(snapshot.files.map((f) => f.name));
  const relativize = (p: string) =>
    snapshot.files.some((f) => f.relative === p);

  return RULES.map((rule) => {
    const { severity, detail } = rule.run(snapshot, names, relativize);
    return {
      id: rule.id,
      title: rule.title,
      weight: rule.weight,
      severity,
      detail,
    };
  });
}

export function gradeFor(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

export function severityValue(s: Severity): number {
  switch (s) {
    case "ok":
      return 1;
    case "warn":
      return 0.5;
    case "fail":
      return 0;
  }
}

export function scoreResults(rules: RuleResult[]): number {
  const total = rules.reduce((acc, r) => acc + r.weight, 0);
  if (total === 0) return 0;
  const earned = rules.reduce(
    (acc, r) => acc + r.weight * severityValue(r.severity),
    0,
  );
  return Math.round((earned / total) * 100);
}

export function overview(snapshot: Snapshot): string[] {
  const lines: string[] = [];
  lines.push(`${snapshot.files.length} file(s) scanned in ${snapshot.root}`);
  if (snapshot.hasGit) lines.push("Git repository detected");
  if (snapshot.hasPackageJson) lines.push("Node/npm project detected");
  return lines;
}
