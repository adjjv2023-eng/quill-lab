import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Severity, Snapshot } from "./types.js";

interface Rule {
  id: string;
  title: string;
  weight: number;
  run(
    s: Snapshot,
    names: Set<string>,
    relativize: (p: string) => boolean,
  ): {
    severity: Severity;
    detail: string;
  };
}

const JUNK_NAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "desktop.ini",
  ".idea",
  ".vscode",
]);

const TEST_PATTERNS: RegExp[] = [
  /\.test\./,
  /\.spec\./,
  /tests?\//,
  /__tests__\//,
];

export const RULES: Rule[] = [
  {
    id: "readme",
    title: "README present",
    weight: 12,
    run: (_s, names) =>
      names.has("README.md") || names.has("README")
        ? { severity: "ok", detail: "README.md found" }
        : {
            severity: "fail",
            detail:
              "No README.md — new contributors are guessing how to start.",
          },
  },
  {
    id: "license",
    title: "License file",
    weight: 8,
    run: (_s, names) =>
      names.has("LICENSE") || names.has("LICENSE.md") || names.has("COPYING")
        ? { severity: "ok", detail: "License detected" }
        : {
            severity: "warn",
            detail: "No LICENSE — consider adding one before publishing.",
          },
  },
  {
    id: "gitignore",
    title: ".gitignore present",
    weight: 8,
    run: (_s, names) =>
      names.has(".gitignore")
        ? { severity: "ok", detail: ".gitignore found" }
        : {
            severity: "fail",
            detail: "No .gitignore — build artifacts could be committed.",
          },
  },
  {
    id: "gitignore-health",
    title: ".gitignore coverage",
    weight: 6,
    run: (s) => {
      const { present, missing } = s.recommendedGitignore;
      if (present === 4)
        return { severity: "ok", detail: "Covers all common ignore entries." };
      if (present >= 2)
        return { severity: "warn", detail: `Missing: ${missing.join(", ")}` };
      return {
        severity: "fail",
        detail: `Missing common entries: ${missing.join(", ")}`,
      };
    },
  },
  {
    id: "ci",
    title: "Continuous integration",
    weight: 10,
    run: (s) => {
      const hasCi = s.files.some(
        (f) =>
          f.relative.startsWith(".github/workflows") ||
          f.relative.startsWith(".gitlab-ci") ||
          f.relative.startsWith(".circleci"),
      );
      return hasCi
        ? { severity: "ok", detail: "CI workflow found" }
        : {
            severity: "fail",
            detail: "No CI pipeline configured — regressions ship silently.",
          };
    },
  },
  {
    id: "codeowners",
    title: "Code ownership",
    weight: 5,
    run: (_s, _n, relativize) =>
      relativize("CODEOWNERS")
        ? { severity: "ok", detail: "CODEOWNERS found" }
        : {
            severity: "warn",
            detail: "No CODEOWNERS — changes lack an explicit review path.",
          },
  },
  {
    id: "contributing",
    title: "Contribution guide",
    weight: 5,
    run: (_s, names) =>
      names.has("CONTRIBUTING.md")
        ? { severity: "ok", detail: "CONTRIBUTING.md found" }
        : { severity: "warn", detail: "No CONTRIBUTING.md." },
  },
  {
    id: "security-policy",
    title: "Security policy",
    weight: 6,
    run: (_s, names) =>
      names.has("SECURITY.md")
        ? { severity: "ok", detail: "SECURITY.md found" }
        : {
            severity: "warn",
            detail: "No SECURITY.md — vulnerability process is unclear.",
          },
  },
  {
    id: "no-junk",
    title: "No editor / OS junk",
    weight: 8,
    run: (s) => {
      const junk = s.files.filter((f) => JUNK_NAMES.has(f.name));
      return junk.length === 0
        ? { severity: "ok", detail: "No stray editor or OS files." }
        : {
            severity: "fail",
            detail: `Found tracked junk: ${junk.map((j) => j.name).join(", ")}`,
          };
    },
  },
  {
    id: "lockfile",
    title: "Dependency lockfile",
    weight: 6,
    run: (s, names) => {
      if (!s.hasPackageJson)
        return { severity: "ok", detail: "No package.json to pin." };
      if (
        names.has("package-lock.json") ||
        names.has("yarn.lock") ||
        names.has("pnpm-lock.yaml") ||
        names.has("bun.lockb")
      ) {
        return { severity: "ok", detail: "Lockfile found." };
      }
      return {
        severity: "fail",
        detail: "package.json present without a lockfile.",
      };
    },
  },
  {
    id: "no-vendored-deps",
    title: "Dependencies are not vendored",
    weight: 5,
    run: (_s, names) =>
      names.has("node_modules")
        ? { severity: "fail", detail: "node_modules appears to be committed." }
        : {
            severity: "ok",
            detail: "No vendored dependency directory detected.",
          },
  },
  {
    id: "tests-present",
    title: "Automated tests",
    weight: 8,
    run: (s) => {
      const hasTests = s.files.some((f) =>
        TEST_PATTERNS.some((p) => p.test(f.relative)),
      );
      return hasTests
        ? { severity: "ok", detail: "Test files found." }
        : { severity: "fail", detail: "No tests found." };
    },
  },
  {
    id: "readme-links",
    title: "README is navigable",
    weight: 4,
    run: (s) => {
      if (!s.files.some((f) => f.relative === "README.md")) {
        return { severity: "warn", detail: "No README to evaluate." };
      }
      const readme = s.files.find((f) => f.relative === "README.md");
      const content = readNothing(s.root, readme ? readme.relative : "");
      const links = !content ? 0 : linksIn(content);
      return links > 0
        ? { severity: "ok", detail: `${links} link(s) found for navigation.` }
        : {
            severity: "warn",
            detail: "README has no links — consider linking usage/docs.",
          };
    },
  },
  {
    id: "clean-tree",
    title: "Clean working tree",
    weight: 4,
    run: (s) =>
      shallowIsClean(s)
        ? { severity: "ok", detail: "No uncommitted changes." }
        : { severity: "warn", detail: "Working tree has uncommitted changes." },
  },
  {
    id: "dist-ignored",
    title: "Build output ignored",
    weight: 5,
    run: (s) => {
      const hasDistDir = s.files.some((f) => f.relative.startsWith("dist/"));
      if (!hasDistDir)
        return { severity: "ok", detail: "No build output present." };
      const ignored =
        s.recommendedGitignore.missing.includes("dist/") === false;
      return ignored
        ? { severity: "ok", detail: "Build output is gitignored." }
        : {
            severity: "warn",
            detail: "Build output present and may not be ignored.",
          };
    },
  },
];

function shallowIsClean(s: Snapshot): boolean {
  return !s.dirty;
}

function readNothing(root: string, relative: string): string {
  if (!relative) return "";
  try {
    return readFileSync(join(root, relative), "utf8");
  } catch {
    return "";
  }
}

function linksIn(content: string): number {
  const matches = content.match(/\]\((https?:\/\/[^)\s]+)\)/g) ?? [];
  const bare = content.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  return matches.length + bare.length;
}
