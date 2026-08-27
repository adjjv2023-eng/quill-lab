import type { Report, RuleResult, Severity } from "./types.js";

const ICON: Record<Severity, string> = {
  ok: "ok",
  warn: "!",
  fail: "x",
};

export function formatHuman(report: Report): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`  Morri — repository health report`);
  lines.push(`  ${report.root}`);
  lines.push("");

  for (const rule of report.rules) {
    lines.push(`  [${ICON[rule.severity]}] ${rule.title} (w${rule.weight})`);
    lines.push(`      ${rule.detail}`);
  }

  lines.push("");
  lines.push(`  Score: ${report.score}/100  (grade ${report.grade})`);
  lines.push(`  Audited in ${report.durationMs}ms`);
  lines.push("");
  return lines.join("\n");
}

export function formatJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function formatCompact(jsonStr: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonStr));
  } catch {
    return jsonStr;
  }
}

export function failedRules(rules: RuleResult[]): RuleResult[] {
  return rules.filter((r) => r.severity === "fail");
}
