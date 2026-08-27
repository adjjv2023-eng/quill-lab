import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import type { Snapshot, FileEntry } from "./types.js";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  "build",
  ".next",
  ".cache",
]);

export function snapshot(root: string): Snapshot {
  const files: FileEntry[] = [];
  walk(root, root, files, 0);
  const relativize = (p: string) => files.some((f) => f.relative === p);

  return {
    root,
    files,
    hasGit: existsSync(join(root, ".git")),
    hasPackageJson: relativize("package.json"),
    dirty: !isClean(root),
    recommendedGitignore: evaluateGitignore(root),
  };
}

function walk(
  base: string,
  dir: string,
  out: FileEntry[],
  depth: number,
): void {
  if (depth > 6) return;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === ".git") continue;
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      walk(base, full, out, depth + 1);
    } else {
      out.push({
        name: entry,
        relative: relative(base, full).split("\\").join("/"),
      });
    }
  }
}

function isClean(root: string): boolean {
  if (!existsSync(join(root, ".git"))) return true;
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: root,
      stdio: "ignore",
    });
    const out = execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().length === 0;
  } catch {
    return true;
  }
}

function evaluateGitignore(root: string): {
  present: number;
  missing: string[];
} {
  const path = join(root, ".gitignore");
  const recommended = ["node_modules/", "dist/", ".env", "coverage/"];
  if (!existsSync(path)) {
    return { present: 0, missing: recommended };
  }
  const content = readFileSafe(path).toLowerCase();
  return {
    present: recommended.filter((r) => content.includes(r)).length,
    missing: recommended.filter((r) => !content.includes(r)),
  };
}

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
