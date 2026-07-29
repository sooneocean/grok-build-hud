/**
 * Format usage reset times: relative countdown and/or wall clock.
 */
import type { UsageSnapshot } from "./types.js";

export type TimeFormatMode =
  | "relative"
  | "absolute"
  | "both";

/** Local wall clock HH:MM from ISO or Date. */
export function formatWallClock(isoOrDate: string | Date): string {
  const d =
    typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Build reset fragment for usage chip.
 * relative → "3h"
 * absolute → "14:30"
 * both → "3h·14:30"
 */
export function formatResetFragment(
  usage: UsageSnapshot,
  mode: TimeFormatMode = "relative",
): string {
  const rel = usage.resetsIn?.trim() || "";
  let abs = "";
  if (usage.resetsAt) abs = formatWallClock(usage.resetsAt);
  if (mode === "absolute") return abs || rel;
  if (mode === "both") {
    if (rel && abs) return `${rel}·${abs}`;
    return rel || abs;
  }
  return rel || abs;
}
