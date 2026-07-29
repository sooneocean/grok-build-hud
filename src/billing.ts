import fs from "node:fs";
import path from "node:path";
import type { UsageSnapshot } from "./types.js";

export interface BillingAuth {
  token: string;
  teamId?: string;
  email?: string;
}

export interface BillingFetchDeps {
  readAuth?: (grokHome: string) => BillingAuth | null;
  fetchJson?: (
    url: string,
    headers: Record<string, string>,
  ) => Promise<{ ok: boolean; status: number; body: unknown }>;
  now?: () => number;
}

/** Real Grok Build billing endpoints (session OIDC token). */
export const BILLING_CREDITS_URL =
  "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
export const BILLING_MONTHLY_URL =
  "https://cli-chat-proxy.grok.com/v1/billing";

const cache = new Map<string, { at: number; value: UsageSnapshot }>();

export function readGrokAuth(grokHome: string): BillingAuth | null {
  const authPath = path.join(grokHome, "auth.json");
  try {
    if (!fs.existsSync(authPath)) return null;
    const raw = JSON.parse(fs.readFileSync(authPath, "utf8")) as Record<
      string,
      Record<string, unknown>
    >;
    for (const entry of Object.values(raw)) {
      if (!entry || typeof entry !== "object") continue;
      const token =
        (entry.key as string | undefined) ??
        (entry.access_token as string | undefined) ??
        (entry.token as string | undefined);
      if (token && typeof token === "string") {
        return {
          token,
          teamId: entry.team_id as string | undefined,
          email: entry.email as string | undefined,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Unwrap xAI `{ val: number }` or plain number/string. */
export function numVal(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  if (v && typeof v === "object" && "val" in (v as object)) {
    return numVal((v as { val: unknown }).val);
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/**
 * Normalize Grok cli-chat-proxy billing JSON (and generic shapes).
 */
export function normalizeBillingPayload(body: unknown): UsageSnapshot {
  if (body == null || typeof body !== "object") {
    return {
      available: false,
      message: "usage unavailable",
      source: "empty",
    };
  }
  const root = body as Record<string, unknown>;
  const config = asRecord(root.config) ?? asRecord(root.credits) ?? root;

  // Weekly / unified credits percent (preferred for "quota bar")
  const creditPct = numVal(config.creditUsagePercent ?? config.percent_used ?? config.percent);
  let productBreakdown: string | undefined;
  const products = config.productUsage;
  if (Array.isArray(products)) {
    const bits: string[] = [];
    for (const p of products) {
      const pr = asRecord(p);
      if (!pr) continue;
      const name = String(pr.product ?? "");
      const pct = numVal(pr.usagePercent);
      if (name && pct != null) bits.push(`${name} ${Math.round(pct)}%`);
    }
    if (bits.length) productBreakdown = bits.join(", ");
  }

  // Monthly absolute credits
  const used =
    numVal(config.used) ??
    numVal(config.used_credits) ??
    numVal(config.monthly_used) ??
    numVal(root.used);
  const limit =
    numVal(config.monthlyLimit) ??
    numVal(config.monthly_limit) ??
    numVal(config.limit) ??
    numVal(root.monthlyLimit) ??
    numVal(root.limit);

  let percent = creditPct;
  if (percent == null && used != null && limit != null && limit > 0) {
    percent = (used / limit) * 100;
  }

  const periodTypeRaw =
    (asRecord(config.currentPeriod)?.type as string | undefined) ??
    (config.period as string | undefined);
  let period = "monthly";
  if (periodTypeRaw && /week/i.test(periodTypeRaw)) period = "weekly";
  else if (creditPct != null && used == null) period = "weekly";
  else if (limit != null) period = "monthly";

  const periodEnd =
    (asRecord(config.currentPeriod)?.end as string | undefined) ??
    (config.billingPeriodEnd as string | undefined) ??
    (config.periodEnd as string | undefined) ??
    (typeof config.reset_at === "string" ? config.reset_at : undefined);
  const resetsIn = formatResets(periodEnd ?? config.reset_at);
  const resetsAt = absoluteResetIso(periodEnd ?? config.reset_at);

  if (percent == null && used == null && limit == null) {
    return {
      available: false,
      message: "usage unavailable",
      source: "unrecognized",
    };
  }

  return {
    available: true,
    percent: percent != null ? Math.max(0, Math.min(100, percent)) : undefined,
    used: used ?? undefined,
    limit: limit ?? undefined,
    period,
    resetsIn,
    resetsAt,
    source: "billing",
    message: productBreakdown,
  };
}

/**
 * Merge weekly credits view + monthly absolute into one snapshot.
 * Prefer weekly % for the bar when present; keep monthly used/limit as detail.
 */
export function mergeBillingSnapshots(
  credits: UsageSnapshot,
  monthly: UsageSnapshot,
): UsageSnapshot {
  if (!credits.available && !monthly.available) {
    return credits.available === false ? credits : monthly;
  }
  const percent =
    credits.available && credits.percent != null
      ? credits.percent
      : monthly.percent;
  const period =
    credits.available && credits.percent != null
      ? credits.period ?? "weekly"
      : monthly.period ?? "monthly";
  return {
    available: true,
    percent,
    used: monthly.used ?? credits.used,
    limit: monthly.limit ?? credits.limit,
    period,
    resetsIn: credits.resetsIn ?? monthly.resetsIn,
    resetsAt: credits.resetsAt ?? monthly.resetsAt,
    source: "billing",
    message: credits.message ?? monthly.message,
  };
}

function absoluteResetIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
    return undefined;
  }
  if (typeof v === "number") {
    const ms =
      v > 1e12 ? v : v > 1e10 ? v : v > 1e9 ? v * 1000 : Date.now() + v * 1000;
    return new Date(ms).toISOString();
  }
  return undefined;
}

function formatResets(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) {
      const sec = Math.max(0, Math.floor((t - Date.now()) / 1000));
      return humanDuration(sec);
    }
    return v;
  }
  if (typeof v === "number") {
    const sec =
      v > 1e12
        ? Math.floor((v - Date.now()) / 1000)
        : v > 1e10
          ? Math.floor(v / 1000)
          : v;
    return humanDuration(Math.max(0, sec));
  }
  return undefined;
}

function humanDuration(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${m}m`;
}

async function defaultFetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { headers });
  let body: unknown = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Fetch credit/quota usage. Never throws.
 * Uses cli-chat-proxy (same as Grok `/usage`).
 */
export async function getCreditUsage(
  grokHome: string,
  options: {
    cacheTtlMs?: number;
    enabled?: boolean;
  } = {},
  deps: BillingFetchDeps = {},
): Promise<UsageSnapshot> {
  if (options.enabled === false) {
    return {
      available: false,
      message: "usage disabled",
      source: "disabled",
    };
  }

  const cacheTtl = options.cacheTtlMs ?? 60_000;
  const now = deps.now?.() ?? Date.now();
  const cacheKey = grokHome;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < cacheTtl) {
    return hit.value;
  }

  // Disk cache for hook processes (each process has empty memory cache)
  const disk = readDiskCache(grokHome, cacheTtl, now);
  if (disk) {
    cache.set(cacheKey, { at: now, value: disk });
    return disk;
  }

  const readAuth = deps.readAuth ?? readGrokAuth;
  const auth = readAuth(grokHome);
  if (!auth?.token) {
    try {
      const { readUsageSidecar } = await import("./usage-sidecar.js");
      const side = readUsageSidecar(grokHome, { now });
      if (side?.available) {
        cache.set(cacheKey, { at: now, value: side });
        return side;
      }
    } catch {
      /* optional */
    }
    const value: UsageSnapshot = {
      available: false,
      message: "usage unavailable (no auth)",
      source: "no-auth",
    };
    cache.set(cacheKey, { at: now, value });
    return value;
  }

  const fetchJson = deps.fetchJson ?? defaultFetchJson;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.token}`,
    Accept: "application/json",
    "User-Agent": "grok-build-hud/0.2",
  };
  if (auth.teamId) headers["x-team-id"] = auth.teamId;

  let creditsSnap: UsageSnapshot = {
    available: false,
    message: "usage unavailable",
    source: "fetch-failed",
  };
  let monthlySnap: UsageSnapshot = {
    available: false,
    message: "usage unavailable",
    source: "fetch-failed",
  };

  try {
    const r = await fetchJson(BILLING_CREDITS_URL, headers);
    if (r.ok) creditsSnap = normalizeBillingPayload(r.body);
  } catch {
    /* ignore */
  }
  try {
    const r = await fetchJson(BILLING_MONTHLY_URL, headers);
    if (r.ok) monthlySnap = normalizeBillingPayload(r.body);
  } catch {
    /* ignore */
  }

  // Fallback URLs (older / alternate)
  if (!creditsSnap.available && !monthlySnap.available) {
    for (const url of [
      "https://api.x.ai/v1/billing?format=credits",
      "https://api.x.ai/v1/billing",
    ]) {
      try {
        const res = await fetchJson(url, headers);
        if (!res.ok) continue;
        const n = normalizeBillingPayload(res.body);
        if (n.available) {
          cache.set(cacheKey, { at: now, value: n });
          writeDiskCache(grokHome, n);
          try {
            const { writeUsageSidecar } = await import("./usage-sidecar.js");
            writeUsageSidecar(grokHome, n);
          } catch {
            /* ignore */
          }
          return n;
        }
      } catch {
        continue;
      }
    }
  }

  const value = mergeBillingSnapshots(creditsSnap, monthlySnap);
  if (value.available) {
    cache.set(cacheKey, { at: now, value });
    writeDiskCache(grokHome, value);
    try {
      const { writeUsageSidecar } = await import("./usage-sidecar.js");
      writeUsageSidecar(grokHome, value);
    } catch {
      /* optional */
    }
    return value;
  }

  // D4: fall back to local usage sidecar when live billing misses
  try {
    const { readUsageSidecar } = await import("./usage-sidecar.js");
    const side = readUsageSidecar(grokHome, { now });
    if (side?.available) {
      cache.set(cacheKey, { at: now, value: side });
      return side;
    }
  } catch {
    /* optional */
  }

  cache.set(cacheKey, { at: now, value });
  return value;
}

function diskCachePath(grokHome: string): string {
  return path.join(grokHome, "hud", "billing-cache.json");
}

function readDiskCache(
  grokHome: string,
  ttlMs: number,
  now: number,
): UsageSnapshot | null {
  try {
    const p = diskCachePath(grokHome);
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
      at: number;
      value: UsageSnapshot;
    };
    if (!raw?.value?.available) return null;
    if (now - raw.at > ttlMs) return null;
    return { ...raw.value, source: "billing" };
  } catch {
    return null;
  }
}

function writeDiskCache(grokHome: string, value: UsageSnapshot): void {
  try {
    const dir = path.join(grokHome, "hud");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      diskCachePath(grokHome),
      JSON.stringify({ at: Date.now(), value }, null, 2) + "\n",
      "utf8",
    );
  } catch {
    /* ignore */
  }
}

export function clearUsageCache(): void {
  cache.clear();
}

export function unavailableUsage(message = "usage unavailable"): UsageSnapshot {
  return { available: false, message, source: "offline" };
}
