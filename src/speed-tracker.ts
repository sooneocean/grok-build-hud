/**
 * Output token speed (tok/s) from successive last-turn / session output totals.
 * Opt-in via display.showSpeed. Scoped per sessionId so parallel terminals
 * do not share cache.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const MIN_DELTA_MS = 500;
const MAX_AGE_MS = 30_000;

interface SpeedCache {
  outputTokens: number;
  timestamp: number;
}

function cachePath(grokHome: string, sessionId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(sessionId)
    .digest("hex")
    .slice(0, 16);
  return path.join(grokHome, "hud", "speed-cache", `${hash}.json`);
}

function readCache(p: string): SpeedCache | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as SpeedCache;
    if (
      typeof raw.outputTokens !== "number" ||
      typeof raw.timestamp !== "number"
    ) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function writeCache(p: string, cache: SpeedCache): void {
  try {
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(p, JSON.stringify(cache) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Given current cumulative (or last-turn) output tokens, return tok/s or null.
 * Updates on-disk cache for the next sample.
 */
export function measureOutputSpeed(
  grokHome: string,
  sessionId: string,
  outputTokens: number,
  options: { now?: number } = {},
): number | null {
  if (!sessionId || !Number.isFinite(outputTokens) || outputTokens < 0) {
    return null;
  }
  const now = options.now ?? Date.now();
  const p = cachePath(grokHome, sessionId);
  const prev = readCache(p);

  // Always refresh cache so next tick has a baseline
  writeCache(p, { outputTokens, timestamp: now });

  if (!prev) return null;
  const dt = now - prev.timestamp;
  if (dt < MIN_DELTA_MS || dt > MAX_AGE_MS) return null;
  const dTok = outputTokens - prev.outputTokens;
  if (dTok <= 0) return null;
  const perSec = (dTok / dt) * 1000;
  if (!Number.isFinite(perSec) || perSec <= 0) return null;
  // Cap absurd spikes (sub-second burst noise)
  return Math.min(perSec, 5000);
}

/** Format for HUD: `42 tok/s` or `12.4 tok/s`. */
export function formatSpeed(tokPerSec: number): string {
  if (tokPerSec >= 100) return `${Math.round(tokPerSec)} tok/s`;
  if (tokPerSec >= 10) return `${tokPerSec.toFixed(1)} tok/s`;
  return `${tokPerSec.toFixed(2)} tok/s`;
}
