import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { contextPercentFromSignals } from "./bar.js";
import { parseUpdatesBundle } from "./activity.js";
import {
  durationFromSummary,
  estimateContextFromSessionDir,
  parseEventsFile,
} from "./events.js";
import { readGitInfo } from "./git.js";
import { measureOutputSpeed } from "./speed-tracker.js";
import { loadHudConfig } from "./hud-config.js";
import type {
  ActiveSessionEntry,
  SessionSignals,
  SessionSnapshot,
  SessionSummary,
} from "./types.js";

/** Snapshot cache: skip re-parse when session files unchanged (1.3). */
const snapCache = new Map<
  string,
  { fp: string; snap: SessionSnapshot; at: number }
>();

export function clearSnapshotCache(): void {
  snapCache.clear();
}

/** Light fingerprint of session inputs (mtime+size). */
export function sessionInputFingerprint(sessionDir: string): string {
  const names = [
    "signals.json",
    "summary.json",
    "updates.jsonl",
    "events.jsonl",
  ];
  const bits: string[] = [];
  for (const n of names) {
    try {
      const p = path.join(sessionDir, n);
      if (!fs.existsSync(p)) {
        bits.push(`${n}:0`);
        continue;
      }
      const st = fs.statSync(p);
      bits.push(`${n}:${st.mtimeMs}:${st.size}`);
    } catch {
      bits.push(`${n}:?`);
    }
  }
  return bits.join("|");
}

export function defaultGrokHome(): string {
  return process.env.GROK_HOME?.trim() || path.join(os.homedir(), ".grok");
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

const activeSessionsCache = new Map<
  string,
  { mtimeMs: number; entries: ActiveSessionEntry[] }
>();

export function loadActiveSessions(grokHome: string): ActiveSessionEntry[] {
  const p = path.join(grokHome, "active_sessions.json");
  try {
    if (!fs.existsSync(p)) {
      activeSessionsCache.delete(grokHome);
      return [];
    }
    const mtimeMs = fs.statSync(p).mtimeMs;
    const hit = activeSessionsCache.get(grokHome);
    if (hit && hit.mtimeMs === mtimeMs) return hit.entries;
    const data = readJsonFile<
      ActiveSessionEntry[] | { sessions?: ActiveSessionEntry[] }
    >(p);
    let entries: ActiveSessionEntry[] = [];
    if (Array.isArray(data)) entries = data;
    else if (data && Array.isArray(data.sessions)) entries = data.sessions;
    activeSessionsCache.set(grokHome, { mtimeMs, entries });
    return entries;
  } catch {
    activeSessionsCache.delete(grokHome);
    return [];
  }
}

export function isPidAlive(pid?: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Encode cwd the way Grok names session parent dirs. */
export function encodeCwdDirName(cwd: string): string {
  return encodeURIComponent(cwd).replace(/%20/g, "%20");
}

export function listSessionDirs(grokHome: string): string[] {
  const root = path.join(grokHome, "sessions");
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const parent = path.join(root, entry.name);
    // Sessions may be parent-dir/session-id or flat
    for (const child of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const dir = path.join(parent, child.name);
      if (fs.existsSync(path.join(dir, "signals.json")) || fs.existsSync(path.join(dir, "summary.json"))) {
        out.push(dir);
      }
    }
    // Also allow session files directly under sessions/<id>/
    if (
      fs.existsSync(path.join(parent, "signals.json")) ||
      fs.existsSync(path.join(parent, "summary.json"))
    ) {
      out.push(parent);
    }
  }
  return out;
}

export function mtimeMs(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

/** Parse ISO timestamps; invalid → 0. */
export function parseTimeMs(value?: string | null): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Recency score for picking "the session you are actually in".
 * After /new, both old and new Grok processes can stay live; array order in
 * active_sessions.json is insertion order (oldest first), so we must rank by
 * activity — not by list position.
 *
 * IMPORTANT: do NOT rank by signals.json mtime alone. An older live session
 * keeps rewriting signals while a brand-new Terminal is still at ctx 0%, and
 * that made the HUD "stick" on the old high context.
 */
export function sessionRecencyMs(
  session: SessionSnapshot,
  activeEntry?: ActiveSessionEntry,
): number {
  const opened = parseTimeMs(activeEntry?.opened_at);
  const lastActive = parseTimeMs(session.summary?.last_active_at);
  const updated = parseTimeMs(session.summary?.updated_at);
  const created = parseTimeMs(session.summary?.created_at);
  // User-facing activity only (not signals keepalive rewrites)
  const semantic = Math.max(opened, lastActive, updated, created);
  const fileM = Math.max(
    mtimeMs(path.join(session.sessionDir, "summary.json")),
    mtimeMs(path.join(session.sessionDir, "updates.jsonl")),
    mtimeMs(path.join(session.sessionDir, "chat_history.jsonl")),
  );
  // Prefer semantic timestamps; use file mtime only as a weak boost when
  // semantic exists (never let signals-only rewrites dominate).
  if (semantic > 0) {
    return Math.max(semantic, fileM);
  }
  return fileM;
}

/** live first, then most recently active. */
export function compareSessionsByRecency(
  a: SessionSnapshot,
  b: SessionSnapshot,
  active: ActiveSessionEntry[] = [],
): number {
  if (a.live !== b.live) return a.live ? -1 : 1;
  const ae = active.find((x) => x.session_id === a.sessionId);
  const be = active.find((x) => x.session_id === b.sessionId);
  return sessionRecencyMs(b, be) - sessionRecencyMs(a, ae);
}

export function sortSessionsByRecency(
  sessions: SessionSnapshot[],
  active: ActiveSessionEntry[] = [],
): SessionSnapshot[] {
  return [...sessions].sort((a, b) => compareSessionsByRecency(a, b, active));
}

/**
 * Prefer the newest live session among active_sessions.
 * Fixes HUD stuck on an older tab's ctx% after the user runs /new.
 *
 * When several sessions are live, break ties with opened_at (newest Terminal
 * /newest /new wins) so a brand-new window at ctx 0% is not displaced by an
 * older busy session that still rewrites signals.
 */
export function pickFromActiveSessions(
  grokHome: string,
  options: { cwd?: string; preferLive?: boolean } = {},
): SessionSnapshot | null {
  const active = loadActiveSessions(grokHome);
  if (!active.length) return null;

  const snaps: SessionSnapshot[] = [];
  for (const a of active) {
    const dir = findSessionDirById(grokHome, a.session_id);
    if (!dir) continue;
    if (options.cwd && a.cwd && !pathsEqual(a.cwd, options.cwd)) {
      // still allow load if summary cwd matches later
    }
    const snap = loadSnapshotFromDir(dir, { active });
    if (!snap) continue;
    if (options.cwd && snap.cwd && !pathsEqual(snap.cwd, options.cwd)) {
      if (!(a.cwd && pathsEqual(a.cwd, options.cwd))) continue;
    }
    snaps.push(snap);
  }
  if (!snaps.length) return null;

  const ranked = sortSessionsByRecency(snaps, active);
  if (options.preferLive !== false) {
    const live = ranked.filter((s) => s.live);
    if (live.length === 1) return live[0]!;
    if (live.length > 1) {
      // Newest open wins among live (new window / /new)
      return [...live].sort((a, b) => {
        const ae = active.find((x) => x.session_id === a.sessionId);
        const be = active.find((x) => x.session_id === b.sessionId);
        const ao = parseTimeMs(ae?.opened_at);
        const bo = parseTimeMs(be?.opened_at);
        if (ao !== bo) return bo - ao;
        return sessionRecencyMs(b, be) - sessionRecencyMs(a, ae);
      })[0]!;
    }
  }
  return ranked[0] ?? null;
}

/** Minimal snapshot for a brand-new Terminal (ctx 0%, no session yet). */
export function emptySessionSnapshot(
  overrides: Partial<SessionSnapshot> = {},
): SessionSnapshot {
  return {
    sessionId: "—",
    sessionDir: "",
    cwd: "",
    model: "—",
    live: false,
    contextPercent: 0,
    contextTokensUsed: 0,
    contextWindowTokens: 0,
    turnCount: 0,
    userMessageCount: 0,
    toolCallCount: 0,
    toolFailureCount: 0,
    errorCount: 0,
    durationSeconds: 0,
    agentLinesAdded: 0,
    agentLinesRemoved: 0,
    compactionCount: 0,
    avgTtftMs: 0,
    tools: [],
    agents: [],
    todos: [],
    signals: {},
    ...overrides,
  };
}

export function loadSnapshotFromDir(
  sessionDir: string,
  options: {
    active?: ActiveSessionEntry[];
    preferLive?: boolean;
    /** Measure tok/s (writes speed-cache). Default: follow HUD showSpeed. */
    trackSpeed?: boolean;
    /** Bypass mtime snapshot cache. */
    bypassCache?: boolean;
  } = {},
): SessionSnapshot | null {
  if (!sessionDir || !fs.existsSync(sessionDir)) return null;

  const signalsPath = path.join(sessionDir, "signals.json");
  const summaryPath = path.join(sessionDir, "summary.json");
  // Require at least one of the core session files
  if (!fs.existsSync(signalsPath) && !fs.existsSync(summaryPath)) return null;

  const active = options.active ?? [];
  const fp = sessionInputFingerprint(sessionDir);
  if (!options.bypassCache) {
    const hit = snapCache.get(sessionDir);
    if (hit && hit.fp === fp) {
      // Re-bind live/pid + git (working tree can change without session files)
      const sessionId =
        hit.snap.sessionId || path.basename(sessionDir) || "unknown";
      const activeHit = active.find((a) => a.session_id === sessionId);
      const pid = activeHit?.pid;
      const live = Boolean(activeHit && isPidAlive(pid));
      const cwd = hit.snap.cwd || activeHit?.cwd || hit.snap.cwd;
      const git = cwd ? readGitInfo(cwd) : { dirty: false as boolean };
      return {
        ...hit.snap,
        live,
        pid,
        cwd,
        gitDirty: git.dirty,
        gitAhead: git.ahead,
        gitBehind: git.behind,
        gitFileStats: git.fileStats,
        branch: git.branch ?? hit.snap.branch,
      };
    }
  }

  const hasSignalsFile = fs.existsSync(signalsPath);
  const signals =
    readJsonFile<SessionSignals>(signalsPath) ?? {};
  const summary =
    readJsonFile<SessionSummary>(summaryPath) ?? undefined;

  const sessionId =
    summary?.info?.id ??
    path.basename(sessionDir) ??
    "unknown";

  const cwd =
    summary?.info?.cwd ??
    decodeCwdGuess(sessionDir) ??
    "";

  const activeHit = active.find((a) => a.session_id === sessionId);
  const pid = activeHit?.pid;
  const live = Boolean(activeHit && isPidAlive(pid));

  const model =
    (typeof signals.primaryModelId === "string" && signals.primaryModelId) ||
    (Array.isArray(signals.modelsUsed) && signals.modelsUsed[0]) ||
    summary?.current_model_id ||
    "unknown";

  // events.jsonl: reliable mid-turn when signals lag
  const eventsPath = path.join(sessionDir, "events.jsonl");
  const events = parseEventsFile(eventsPath);

  let percent = contextPercentFromSignals(signals);
  let contextTokensUsed =
    typeof signals.contextTokensUsed === "number" ? signals.contextTokensUsed : 0;
  let contextWindowTokens =
    typeof signals.contextWindowTokens === "number"
      ? signals.contextWindowTokens
      : 0;

  // No signals (or zeroed context) → estimate from local session files so
  // the bar is not stuck at 0% during the first turn / broken writers.
  if (
    (!hasSignalsFile || (contextTokensUsed <= 0 && percent <= 0)) &&
    sessionDir
  ) {
    const est = estimateContextFromSessionDir(
      sessionDir,
      contextWindowTokens > 0 ? contextWindowTokens : 500_000,
    );
    if (est.contextTokensUsed > 0) {
      contextTokensUsed = est.contextTokensUsed;
      contextWindowTokens = est.contextWindowTokens;
      percent = est.contextPercent;
    }
  }

  const updatesPath = path.join(sessionDir, "updates.jsonl");
  // Single read: tools + token usage (was double-parse every tick)
  const bundle = parseUpdatesBundle(updatesPath);
  // Fallback: toolsUsed from signals when updates empty
  let tools = bundle.tools;
  if (!tools.length && Array.isArray(signals.toolsUsed) && signals.toolsUsed.length) {
    tools = signals.toolsUsed.map((name, i) => ({
      id: `sig-${i}`,
      name,
      status: "completed" as const,
      count: 1,
    }));
  }
  if (!tools.length && events.toolsUsed.length) {
    tools = events.toolsUsed.map((name, i) => ({
      id: `ev-${i}`,
      name,
      status: "completed" as const,
      count: 1,
    }));
  }

  const git = cwd ? readGitInfo(cwd) : { dirty: false as boolean };
  const branch = git.branch ?? summary?.head_branch;

  const sigTurn =
    typeof signals.turnCount === "number" ? signals.turnCount : 0;
  const sigTools =
    typeof signals.toolCallCount === "number" ? signals.toolCallCount : 0;
  const sigFail =
    typeof signals.toolFailureCount === "number" ? signals.toolFailureCount : 0;
  // Prefer the higher of signals vs events (events stay fresh mid-turn)
  const turnCount = Math.max(sigTurn, events.turnCount);
  const toolCallCount = Math.max(sigTools, events.toolCallCount);
  const toolFailureCount = Math.max(sigFail, events.toolFailureCount);

  const sigDuration =
    typeof signals.sessionDurationSeconds === "number"
      ? signals.sessionDurationSeconds
      : 0;
  const durationSeconds =
    sigDuration > 0 ? sigDuration : durationFromSummary(summary);

  const lastTurn = bundle.lastTurn;
  const sessionTok = bundle.turnCount > 0 ? bundle.session : null;
  // Prefer session cumulative output for smoother tok/s; fall back to last turn
  const outTok =
    sessionTok && sessionTok.outputTokens > 0
      ? sessionTok.outputTokens
      : (lastTurn?.outputTokens ?? 0);
  const grokHomeGuess = grokHomeFromSessionDir(sessionDir);
  let trackSpeed = options.trackSpeed;
  if (trackSpeed === undefined) {
    try {
      trackSpeed = Boolean(loadHudConfig(grokHomeGuess).display?.showSpeed);
    } catch {
      trackSpeed = false;
    }
  }
  const outputTokensPerSecond =
    trackSpeed && outTok > 0
      ? measureOutputSpeed(grokHomeGuess, sessionId, outTok)
      : null;

  const snap: SessionSnapshot = {
    sessionId,
    sessionDir,
    cwd: cwd || activeHit?.cwd || "",
    model: String(model),
    title: summary?.generated_title ?? summary?.session_summary,
    branch,
    gitDirty: git.dirty,
    gitAhead: git.ahead,
    gitBehind: git.behind,
    gitFileStats: git.fileStats,
    live,
    pid,
    contextPercent: percent,
    contextTokensUsed,
    contextWindowTokens,
    turnCount,
    userMessageCount:
      typeof signals.userMessageCount === "number" ? signals.userMessageCount : 0,
    toolCallCount,
    toolFailureCount,
    errorCount: typeof signals.errorCount === "number" ? signals.errorCount : 0,
    durationSeconds,
    agentLinesAdded:
      typeof signals.agentLinesAdded === "number" ? signals.agentLinesAdded : 0,
    agentLinesRemoved:
      typeof signals.agentLinesRemoved === "number"
        ? signals.agentLinesRemoved
        : 0,
    compactionCount:
      typeof signals.compactionCount === "number" ? signals.compactionCount : 0,
    avgTtftMs:
      typeof signals.avgTimeToFirstTokenMs === "number"
        ? signals.avgTimeToFirstTokenMs
        : 0,
    agentName:
      typeof summary?.agent_name === "string" ? summary.agent_name : undefined,
    reasoningEffort:
      typeof summary?.reasoning_effort === "string"
        ? summary.reasoning_effort
        : undefined,
    lastTurnTokens: lastTurn,
    sessionTokens: sessionTok,
    outputTokensPerSecond,
    tools,
    agents: bundle.agents,
    todos: bundle.todos ?? [],
    signals,
    summary,
  };

  snapCache.set(sessionDir, { fp, snap, at: Date.now() });
  return snap;
}

/** `…/.grok/sessions/<cwd>/<id>` → `…/.grok` */
export function grokHomeFromSessionDir(sessionDir: string): string {
  const parts = sessionDir.split(path.sep);
  const idx = parts.lastIndexOf("sessions");
  if (idx > 0) {
    const home = parts.slice(0, idx).join(path.sep);
    if (home) return home;
  }
  return defaultGrokHome();
}

function decodeCwdGuess(sessionDir: string): string | undefined {
  const parent = path.basename(path.dirname(sessionDir));
  try {
    if (parent.includes("%")) return decodeURIComponent(parent);
  } catch {
    /* ignore */
  }
  return undefined;
}

export interface DiscoverOptions {
  grokHome?: string;
  sessionId?: string;
  cwd?: string;
  sessionDir?: string;
}

export function discoverSessions(options: DiscoverOptions = {}): SessionSnapshot[] {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const active = loadActiveSessions(grokHome);

  if (options.sessionDir) {
    const snap = loadSnapshotFromDir(options.sessionDir, { active });
    return snap ? [snap] : [];
  }

  const dirs = listSessionDirs(grokHome);
  const snaps: SessionSnapshot[] = [];
  for (const dir of dirs) {
    const snap = loadSnapshotFromDir(dir, { active });
    if (snap) snaps.push(snap);
  }

  let filtered = snaps;
  if (options.sessionId) {
    filtered = snaps.filter(
      (s) =>
        s.sessionId === options.sessionId ||
        s.sessionDir.endsWith(options.sessionId!),
    );
  }
  if (options.cwd) {
    filtered = filtered.filter((s) => {
      if (!s.cwd) return false;
      return pathsEqual(s.cwd, options.cwd!);
    });
    // Also match active_sessions cwd even if summary cwd is missing/stale
    if (!filtered.length) {
      for (const a of active) {
        if (a.cwd && pathsEqual(a.cwd, options.cwd)) {
          const dir = findSessionDirById(grokHome, a.session_id);
          if (dir) {
            const snap = loadSnapshotFromDir(dir, { active });
            if (snap) filtered.push(snap);
          }
        }
      }
    }
  }

  // Sort: live first, then by recency (opened_at / last_active / file mtimes)
  // Do NOT use active_sessions array order — after /new the old tab stays first.
  return sortSessionsByRecency(filtered, active);
}

export function pickBestSession(options: DiscoverOptions = {}): SessionSnapshot | null {
  const all = discoverSessions(options);
  return all[0] ?? null;
}

/** sessionId → absolute dir (rebuilt when sessions root listing changes). */
const sessionDirIndex = new Map<
  string,
  { stamp: string; byId: Map<string, string> }
>();

function sessionsRootStamp(grokHome: string): string {
  const root = path.join(grokHome, "sessions");
  try {
    if (!fs.existsSync(root)) return "0";
    const st = fs.statSync(root);
    // size of readdir as cheap dirtiness proxy + mtime
    const n = fs.readdirSync(root).length;
    return `${st.mtimeMs}:${n}`;
  } catch {
    return "?";
  }
}

function rebuildSessionDirIndex(grokHome: string): Map<string, string> {
  const byId = new Map<string, string>();
  for (const dir of listSessionDirs(grokHome)) {
    byId.set(path.basename(dir), dir);
  }
  sessionDirIndex.set(grokHome, {
    stamp: sessionsRootStamp(grokHome),
    byId,
  });
  return byId;
}

export function clearSessionDirIndex(): void {
  sessionDirIndex.clear();
  activeSessionsCache.clear();
}

/** Find session directory by exact session id (basename). */
export function findSessionDirById(
  grokHome: string,
  sessionId: string,
): string | null {
  if (!sessionId) return null;
  const stamp = sessionsRootStamp(grokHome);
  let idx = sessionDirIndex.get(grokHome);
  if (!idx || idx.stamp !== stamp) {
    rebuildSessionDirIndex(grokHome);
    idx = sessionDirIndex.get(grokHome)!;
  }
  const hit = idx.byId.get(sessionId);
  if (hit && fs.existsSync(hit)) return hit;
  // Miss: rebuild once (new session created mid-tick)
  rebuildSessionDirIndex(grokHome);
  const again = sessionDirIndex.get(grokHome)?.byId.get(sessionId);
  if (again && fs.existsSync(again)) return again;
  return null;
}

/** Normalize paths for cwd matching (symlink / trailing slash / case). */
export function pathsEqual(a: string, b: string): boolean {
  try {
    const ra = fs.realpathSync(path.resolve(a));
    const rb = fs.realpathSync(path.resolve(b));
    return ra === rb;
  } catch {
    try {
      return path.resolve(a) === path.resolve(b);
    } catch {
      return a === b;
    }
  }
}
