/**
 * Usage sidecar — local JSON snapshot for other tools / CodexBar-style readers.
 * Written when billing fetch succeeds; optional external path via config.
 */
import fs from "node:fs";
import path from "node:path";
import type { UsageSnapshot } from "./types.js";
import { loadHudConfig } from "./hud-config.js";

export interface UsageSidecarPayload {
  updated_at: string;
  source: string;
  percent?: number;
  used?: number;
  limit?: number;
  period?: string;
  resets_in?: string;
  resets_at?: string;
  message?: string;
  /** Claude-HUD-compatible optional windows */
  five_hour?: { used_percentage?: number; resets_at?: string };
  seven_day?: { used_percentage?: number; resets_at?: string };
}

export function defaultSidecarPath(grokHome: string): string {
  return path.join(grokHome, "hud", "usage-sidecar.json");
}

export function writeUsageSidecar(
  grokHome: string,
  usage: UsageSnapshot,
  options: { path?: string } = {},
): string | null {
  if (!usage?.available) return null;
  try {
    const cfg = loadHudConfig(grokHome);
    const target =
      options.path ||
      (cfg.externalUsageWritePath && cfg.externalUsageWritePath.trim()) ||
      defaultSidecarPath(grokHome);
    if (!target.endsWith(".json")) return null;
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload: UsageSidecarPayload = {
      updated_at: new Date().toISOString(),
      source: usage.source ?? "billing",
      percent: usage.percent,
      used: usage.used,
      limit: usage.limit,
      period: usage.period,
      resets_in: usage.resetsIn,
      resets_at: usage.resetsAt,
      message: usage.message,
    };
    if (usage.period === "weekly" && usage.percent != null) {
      payload.seven_day = {
        used_percentage: usage.percent,
        resets_at: usage.resetsAt,
      };
    }

    fs.writeFileSync(target, JSON.stringify(payload, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    return target;
  } catch {
    return null;
  }
}

export function readUsageSidecar(
  grokHome: string,
  options: {
    path?: string;
    freshnessMs?: number;
    now?: number;
  } = {},
): UsageSnapshot | null {
  try {
    const cfg = loadHudConfig(grokHome);
    const target =
      options.path ||
      (cfg.externalUsagePath && cfg.externalUsagePath.trim()) ||
      defaultSidecarPath(grokHome);
    if (!fs.existsSync(target)) return null;
    const raw = JSON.parse(fs.readFileSync(target, "utf8")) as UsageSidecarPayload;
    const now = options.now ?? Date.now();
    const fresh =
      options.freshnessMs ??
      cfg.externalUsageFreshnessMs ??
      300_000;
    const at = Date.parse(raw.updated_at || "");
    if (!Number.isFinite(at) || now - at > fresh) return null;

    const percent =
      raw.percent ??
      raw.seven_day?.used_percentage ??
      raw.five_hour?.used_percentage;
    if (percent == null && raw.used == null) return null;

    return {
      available: true,
      percent,
      used: raw.used,
      limit: raw.limit,
      period: raw.period,
      resetsIn: raw.resets_in,
      resetsAt: raw.resets_at ?? raw.seven_day?.resets_at,
      message: raw.message,
      source: "sidecar",
    };
  } catch {
    return null;
  }
}
