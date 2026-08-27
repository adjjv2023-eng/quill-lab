import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { snapshot } from "../src/scanner.js";
import { auditRules, scoreResults } from "../src/score.js";
import { failedRules } from "../src/report.js";

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => join(here, "fixtures", name);

describe("scanner", () => {
  it("walks files and indexes a fixture", () => {
    const snap = snapshot(fx("healthy"));
    expect(snap.files.length).toBeGreaterThan(0);
    expect(snap.hasGit).toBe(false);
    expect(snap.hasPackageJson).toBe(true);
    expect(snap.recommendedGitignore.missing).toHaveLength(0);
  });

  it("excludes node_modules and build output", () => {
    const snap = snapshot(fx("healthy"));
    const names = snap.files.map((f) => f.name);
    expect(names).not.toContain("node_modules");
  });

  it("reports missing gitignore recommendations for an underconfigured repo", () => {
    const snap = snapshot(fx("junk"));
    expect(snap.recommendedGitignore.missing.length).toBeGreaterThan(0);
  });
});

describe("rules on a healthy repo", () => {
  it("passes the core hygiene rules", () => {
    const snap = snapshot(fx("healthy"));
    const rules = auditRules(snap);
    const byId = new Map(rules.map((r) => [r.id, r]));

    expect(byId.get("readme")?.severity).toBe("ok");
    expect(byId.get("license")?.severity).toBe("ok");
    expect(byId.get("gitignore")?.severity).toBe("ok");
    expect(byId.get("gitignore-health")?.severity).toBe("ok");
    expect(byId.get("ci")?.severity).toBe("ok");
    expect(byId.get("security-policy")?.severity).toBe("ok");
    expect(byId.get("lockfile")?.severity).toBe("ok");
    expect(byId.get("tests-present")?.severity).toBe("ok");
  });

  it("yields a high score for a healthy repo", () => {
    const snap = snapshot(fx("healthy"));
    const rules = auditRules(snap);
    const score = scoreResults(rules);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it("has no failing rules on a healthy repo", () => {
    const snap = snapshot(fx("healthy"));
    expect(failedRules(auditRules(snap))).toHaveLength(0);
  });
});

describe("rules on a junk repo", () => {
  it("flags editor/OS junk", () => {
    const snap = snapshot(fx("junk"));
    const rules = auditRules(snap);
    const noJunk = rules.find((r) => r.id === "no-junk");
    expect(noJunk?.severity).toBe("fail");
  });

  it("flags the absence of CI and tests", () => {
    const snap = snapshot(fx("junk"));
    const rules = auditRules(snap);
    const ci = rules.find((r) => r.id === "ci");
    const tests = rules.find((r) => r.id === "tests-present");
    expect(ci?.severity).toBe("fail");
    expect(tests?.severity).toBe("fail");
  });
});
