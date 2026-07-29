/**
 * Lightweight local micro-benchmark for snapshot load path.
 */
import {
  defaultGrokHome,
  loadActiveSessions,
  loadSnapshotFromDir,
  findSessionDirById,
  pickBestSession,
  clearSnapshotCache,
  sessionInputFingerprint,
} from "./session.js";
import { clearGitInfoCache } from "./git.js";
import { clearDashboardSessionCache } from "./dashboard.js";

export interface BenchResult {
  iterations: number;
  coldMs: number;
  warmAvgMs: number;
  warmMinMs: number;
  warmMaxMs: number;
  sessionId: string;
  sessionDir: string;
  fingerprint: string;
}

export function runSnapshotBench(
  options: {
    grokHome?: string;
    iterations?: number;
    sessionDir?: string;
  } = {},
): BenchResult {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const iterations = Math.max(3, Math.min(500, options.iterations ?? 30));

  let sessionDir = options.sessionDir;
  let sessionId = "—";
  if (!sessionDir) {
    const active = loadActiveSessions(grokHome);
    for (const a of active) {
      const d = findSessionDirById(grokHome, a.session_id);
      if (d) {
        sessionDir = d;
        sessionId = a.session_id;
        break;
      }
    }
  }
  if (!sessionDir) {
    const best = pickBestSession({ grokHome });
    if (best) {
      sessionDir = best.sessionDir;
      sessionId = best.sessionId;
    }
  }
  if (!sessionDir) {
    throw new Error("no session found for bench — start grok first");
  }

  const active = loadActiveSessions(grokHome);
  const fp = sessionInputFingerprint(sessionDir);

  // Cold: clear all caches
  clearSnapshotCache();
  clearGitInfoCache();
  clearDashboardSessionCache();
  const t0 = performance.now();
  const coldSnap = loadSnapshotFromDir(sessionDir, {
    active,
    trackSpeed: false,
    bypassCache: true,
  });
  const coldMs = performance.now() - t0;
  if (coldSnap?.sessionId) sessionId = coldSnap.sessionId;

  // Warm: same files, allow caches
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const a = performance.now();
    loadSnapshotFromDir(sessionDir, { active, trackSpeed: false });
    times.push(performance.now() - a);
  }
  const warmAvgMs = times.reduce((s, x) => s + x, 0) / times.length;
  const warmMinMs = Math.min(...times);
  const warmMaxMs = Math.max(...times);

  return {
    iterations,
    coldMs,
    warmAvgMs,
    warmMinMs,
    warmMaxMs,
    sessionId,
    sessionDir,
    fingerprint: fp.slice(0, 80),
  };
}

export function formatBenchResult(r: BenchResult): string {
  const f = (n: number) => n.toFixed(2);
  return [
    "grok-hud bench (loadSnapshot)",
    `  session:  ${r.sessionId}`,
    `  dir:      ${r.sessionDir}`,
    `  cold:     ${f(r.coldMs)} ms  (bypass cache)`,
    `  warm avg: ${f(r.warmAvgMs)} ms  (n=${r.iterations})`,
    `  warm min: ${f(r.warmMinMs)} ms`,
    `  warm max: ${f(r.warmMaxMs)} ms`,
    `  note:     warm should be << cold when mtime cache hits`,
  ].join("\n");
}
