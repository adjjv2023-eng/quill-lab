export type Severity = "ok" | "warn" | "fail";

export interface RuleResult {
  id: string;
  title: string;
  weight: number;
  severity: Severity;
  detail: string;
}

export interface FileEntry {
  name: string;
  relative: string;
}

export interface Snapshot {
  root: string;
  files: FileEntry[];
  hasGit: boolean;
  hasPackageJson: boolean;
  dirty: boolean;
  recommendedGitignore: { present: number; missing: string[] };
}

export interface Report {
  root: string;
  score: number;
  grade: Grade;
  durationMs: number;
  rules: RuleResult[];
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface AuditOptions {
  root: string;
  json?: boolean;
  threshold?: number;
  quiet?: boolean;
}
