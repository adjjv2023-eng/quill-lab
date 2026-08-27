import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { snapshot } from "./scanner.js";
import { auditRules, scoreResults, gradeFor, overview } from "./score.js";
import { formatHuman, formatJson, failedRules } from "./report.js";
import type { AuditOptions, Report } from "./types.js";

export { snapshot } from "./scanner.js";
export {
  auditRules,
  scoreResults,
  gradeFor,
  severityValue,
  overview,
} from "./score.js";
export { formatHuman, formatJson, failedRules } from "./report.js";
export type {
  AuditOptions,
  Report,
  RuleResult,
  Severity,
  Grade,
  Snapshot,
  FileEntry,
} from "./types.js";

const VERSION = "0.1.0";

export function audit(options: AuditOptions): Report {
  const root = resolve(options.root || ".");

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const started = Date.now();
  const snap = snapshot(root);
  const rules = auditRules(snap);
  const score = scoreResults(rules);

  return {
    root,
    score,
    grade: gradeFor(score),
    durationMs: Date.now() - started,
    rules,
  };
}

export function run(argv: string[]): number {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(usage());
    return 0;
  }

  try {
    const report = audit({ root: opts.root });
    if (opts.json) {
      console.log(formatJson(report));
    } else {
      if (!opts.quiet) {
        for (const line of overview(snapshot(resolve(opts.root || ".")))) {
          console.log(line);
        }
      }
      console.log(formatHuman(report));
    }

    if (opts.threshold !== undefined && report.score < opts.threshold) {
      return 2;
    }
    if (failedRules(report.rules).length > 0 && !opts.json) {
      // A failing audit is still reported; exit code reflects threshold gate.
    }
    return 0;
  } catch (err) {
    console.error(`morri: ${(err as Error).message}`);
    return 1;
  }
}

interface CliOptions {
  root: string;
  json: boolean;
  quiet: boolean;
  threshold?: number;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    root: ".",
    json: false,
    quiet: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-j":
      case "--json":
        opts.json = true;
        break;
      case "-q":
      case "--quiet":
        opts.quiet = true;
        break;
      case "-t":
      case "--threshold":
        opts.threshold = Number(argv[++i]);
        break;
      default:
        if (a.startsWith("-")) {
          throw new Error(`Unknown option: ${a}`);
        }
        opts.root = a;
    }
  }
  return opts;
}

function usage(): string {
  return [
    `morri ${VERSION} — repository health auditor`,
    "",
    "Usage: morri [path] [options]",
    "",
    "Options:",
    "  -j, --json           Emit a machine-readable JSON report",
    "  -q, --quiet          Suppress the overview banner",
    "  -t, --threshold <n>  Exit with code 2 if score is below n",
    "  -h, --help           Show this help",
    "",
    "Examples:",
    "  morri .",
    "  morri ./packages/api --json",
    "  morri . --threshold 80",
  ].join("\n");
}
