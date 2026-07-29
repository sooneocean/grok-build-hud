/**
 * Progress bar helpers (pure).
 */

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/** Derive percent from explicit usage or used/window tokens. */
export function contextPercentFromSignals(input: {
  contextWindowUsage?: number;
  contextTokensUsed?: number;
  contextWindowTokens?: number;
}): number {
  if (
    typeof input.contextWindowUsage === "number" &&
    Number.isFinite(input.contextWindowUsage)
  ) {
    return clampPercent(input.contextWindowUsage);
  }
  const used = input.contextTokensUsed ?? 0;
  const window = input.contextWindowTokens ?? 0;
  if (window > 0) {
    return clampPercent((used / window) * 100);
  }
  return 0;
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  const m = n / 1_000_000;
  return `${m.toFixed(m >= 10 ? 0 : 1)}M`;
}

export function renderBar(
  percent: number,
  width = 10,
  filledChar = "█",
  emptyChar = "░",
): string {
  const p = clampPercent(percent);
  const filled = Math.round((p / 100) * width);
  const empty = Math.max(0, width - filled);
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0s";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export function projectLabel(cwd: string, levels = 2): string {
  if (!cwd) return "unknown";
  const home = process.env.HOME?.replace(/\\/g, "/") || "";
  let normalized = cwd.replace(/\\/g, "/");
  // Show ~ for home root and paths under home (clearer than "Users/dex")
  if (home && (normalized === home || normalized.startsWith(home + "/"))) {
    const rest = normalized.slice(home.length).replace(/^\//, "");
    if (!rest) return "~";
    const parts = rest.split("/").filter(Boolean);
    const take = Math.max(1, levels);
    const tail = parts.slice(-take).join("/");
    // Under home with only one remaining segment: ~/foo
    if (parts.length <= take) return `~/${tail}`;
    return tail;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return cwd;
  const take = Math.max(1, levels);
  return parts.slice(-take).join("/");
}
