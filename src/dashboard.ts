/**
 * Always-on terminal dashboard: pushes ctx+quota into
 *  - Grok TTY window title (OSC)
 *  - Apple Terminal custom title (osascript fallback)
 *  - ~/.grok/hud/status-line.txt (tmux / external)
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultGrokHome,
  loadActiveSessions,
  loadSnapshotFromDir,
  findSessionDirById,
  pickBestSession,
  pickFromActiveSessions,
  sessionInputFingerprint,
  isPidAlive,
  clearSnapshotCache,
} from "./session.js";
import { getCreditUsage } from "./billing.js";
import { writeStatusFiles, formatCompactLine } from "./status.js";
import { resolveTmuxSessionForGrok } from "./multi-session.js";
import { gitStamp, clearGitInfoCache } from "./git.js";
import { configPath } from "./hud-config.js";
import type { SessionSnapshot, UsageSnapshot } from "./types.js";

/** Soft cap on in-memory session caches (long-running daemon). */
const MAX_CACHED_SESSIONS = 48;

export function dashboardPidPath(grokHome = defaultGrokHome()): string {
  return path.join(grokHome, "hud", "dashboard.pid");
}

export function titleLine(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
): string {
  const compact = formatCompactLine(session, usage);
  // Window titles are short — strip [hud] prefix noise
  return compact.replace(/^\[hud\]\s*/, "◆ ");
}

/** Resolve tty device for a process (e.g. ttys001 → /dev/ttys001). */
export function ttyForPid(pid?: number): string | null {
  if (!pid || pid <= 0) return null;
  try {
    const out = execFileSync("ps", ["-p", String(pid), "-o", "tty="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
    if (!out || out === "??" || out === "-") return null;
    const dev = out.startsWith("/dev/") ? out : `/dev/${out}`;
    if (fs.existsSync(dev)) return dev;
  } catch {
    /* ignore */
  }
  return null;
}

/** Write OSC title sequence to a tty (updates Terminal/iTerm tab title). */
export function writeOscTitle(ttyPath: string, title: string): boolean {
  try {
    const safe = title.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 120);
    // OSC 0 = icon+title, OSC 2 = title only
    const seq = `\x1b]0;${safe}\x07`;
    fs.writeFileSync(ttyPath, seq, { encoding: "utf8", flag: "a" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Apple Terminal: set tab custom title for ONE tty only.
 * Never broadcast to all tabs — that broke parallel Terminal development.
 */
export function setAppleTerminalTitle(
  title: string,
  options: { ttyHint?: string | null } = {},
): boolean {
  if (process.platform !== "darwin") return false;
  const tty = (options.ttyHint || "")
    .replace(/^\/dev\//, "")
    .replace(/"/g, "");
  // Without a tty match target, skip (do not overwrite every tab)
  if (!tty) return false;
  try {
    const safe = title
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .slice(0, 100);
    const script = `
tell application "Terminal"
  set hud to "${safe}"
  set targetTty to "${tty}"
  repeat with w in windows
    repeat with tb in tabs of w
      try
        set t to tty of tb as string
        if t contains targetTty then
          set custom title of tb to hud
        end if
      end try
    end repeat
  end repeat
end tell
`;
    execFileSync("osascript", ["-e", script], {
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 4000,
    });
    return true;
  } catch {
    return false;
  }
}

/** All live Grok sessions (parallel Terminals). */
export function listLiveSessions(grokHome = defaultGrokHome()): SessionSnapshot[] {
  const active = loadActiveSessions(grokHome);
  const out: SessionSnapshot[] = [];
  for (const a of active) {
    const dir = findSessionDirById(grokHome, a.session_id);
    if (!dir) continue;
    const snap = loadSnapshotFromDir(dir, { active });
    if (snap?.live) out.push(snap);
  }
  return out;
}

/** mtime fingerprint of session input files (alias of sessionInputFingerprint). */
export function sessionSourceFingerprint(sessionDir: string): string {
  return sessionInputFingerprint(sessionDir);
}

/** config.json mtime — aesthetic/set must bust pre-skip (1.5). */
export function hudConfigStamp(grokHome: string): string {
  try {
    const p = configPath(grokHome);
    if (!fs.existsSync(p)) return "0";
    return String(fs.statSync(p).mtimeMs);
  } catch {
    return "0";
  }
}

/**
 * Pre-load skip key: file mtimes + live + git stamp + usage + config.
 * When this matches last tick, skip loadSnapshot + writeStatus entirely (1.4+).
 */
export function dashboardPreKey(
  sessionId: string,
  sessionDir: string,
  options: {
    live: boolean;
    cwd?: string;
    usageKey: string;
    configStamp?: string;
  },
): string {
  return [
    sessionId,
    sessionInputFingerprint(sessionDir),
    options.live ? "1" : "0",
    options.cwd ? gitStamp(options.cwd) : "",
    options.usageKey,
    options.configStamp ?? "",
  ].join("|");
}

/**
 * Render identity for skip-write: includes live/pid-derived state that
 * can flip without file mtime changes.
 */
export function sessionRenderKey(
  snap: SessionSnapshot,
  usageKey: string,
): string {
  const tools =
    snap.tools
      ?.slice(0, 6)
      .map((t) => `${t.name}:${t.status}:${t.count ?? 1}`)
      .join(",") ?? "";
  return [
    snap.sessionId,
    snap.live ? "1" : "0",
    snap.contextPercent,
    snap.contextTokensUsed,
    snap.toolCallCount,
    snap.turnCount,
    snap.compactionCount,
    snap.gitDirty ? "d" : "",
    snap.gitAhead ?? "",
    snap.gitBehind ?? "",
    snap.lastTurnTokens?.outputTokens ?? "",
    snap.sessionTokens?.outputTokens ?? "",
    snap.outputTokensPerSecond ?? "",
    tools,
    usageKey,
  ].join("|");
}

/** Last render key per sessionId (in-process dashboard cache). */
const sessionFpCache = new Map<string, { key: string; at: number }>();
/** Pre-load skip keys (avoid loadSnapshot when nothing moved). */
const sessionPreCache = new Map<string, string>();
/** Last title written per session (skip OSC spam). */
const sessionTitleCache = new Map<string, string>();
/** Last known snapshot for skipped primary return. */
const lastSnapById = new Map<string, SessionSnapshot>();
/** Last seen config.json mtime — bust caches on set/settings. */
let lastHudConfigStamp = "";

export function clearDashboardSessionCache(): void {
  sessionFpCache.clear();
  sessionPreCache.clear();
  sessionTitleCache.clear();
  lastSnapById.clear();
  lastHudConfigStamp = "";
}

function pruneSessionCaches(liveIds: Set<string>): void {
  for (const id of [...lastSnapById.keys()]) {
    if (!liveIds.has(id)) {
      lastSnapById.delete(id);
      sessionPreCache.delete(id);
      sessionFpCache.delete(id);
      sessionTitleCache.delete(id);
    }
  }
  // Soft cap (oldest insertion order in Map)
  while (lastSnapById.size > MAX_CACHED_SESSIONS) {
    const first = lastSnapById.keys().next().value as string | undefined;
    if (!first) break;
    lastSnapById.delete(first);
    sessionPreCache.delete(first);
    sessionFpCache.delete(first);
    sessionTitleCache.delete(first);
  }
}

function usageKeyOf(usage: UsageSnapshot | null | undefined): string {
  if (!usage?.available) return "na";
  return [
    usage.percent ?? "",
    usage.resetsIn ?? "",
    usage.resetsAt ?? "",
    usage.message ?? "",
  ].join(",");
}

export async function refreshDashboard(options: {
  grokHome?: string;
  noUsage?: boolean;
  /** Force rewrite even when session inputs unchanged. */
  force?: boolean;
}): Promise<{ title: string; session: SessionSnapshot | null }> {
  const grokHome = options.grokHome ?? defaultGrokHome();

  let usage: UsageSnapshot | null = null;
  if (!options.noUsage) {
    try {
      usage = await getCreditUsage(grokHome, { cacheTtlMs: 60_000 });
    } catch {
      usage = null;
    }
  }
  const uKey = usageKeyOf(usage);
  const cfgStamp = hudConfigStamp(grokHome);
  // Config edit (set/settings) must force re-render even if session files idle
  if (cfgStamp !== lastHudConfigStamp) {
    lastHudConfigStamp = cfgStamp;
    clearDashboardSessionCache();
    clearSnapshotCache();
  }

  // Theme always follows Grok [ui].theme (auto → OS light/dark maps).
  const {
    resolveTheme,
    readGrokUiConfig,
    themeFingerprint,
  } = await import("./theme.js");
  const ui = readGrokUiConfig(grokHome);
  const theme = resolveTheme(undefined, process.env, { grokHome });
  try {
    const stamp = path.join(grokHome, "hud", ".last-theme");
    const fp = themeFingerprint(theme, ui, process.env);
    const prev = fs.existsSync(stamp)
      ? fs.readFileSync(stamp, "utf8").trim()
      : "";
    if (prev !== fp) {
      fs.writeFileSync(stamp, fp + "\n", "utf8");
      const { writeTmuxConfFile, applyTmuxStatusBar } = await import(
        "./tmux-hud.js"
      );
      writeTmuxConfFile(grokHome);
      applyTmuxStatusBar({ grokHome });
      clearDashboardSessionCache();
      clearSnapshotCache();
      clearGitInfoCache();
    }
  } catch {
    /* ignore */
  }

  // Build work list from active_sessions — pre-skip before loadSnapshot (1.4)
  const active = loadActiveSessions(grokHome);
  type WorkItem = {
    sessionId: string;
    dir: string;
    cwd?: string;
    pid?: number;
    live: boolean;
    preKey: string;
    skipLoad: boolean;
  };
  const work: WorkItem[] = [];
  for (const a of active) {
    const dir = findSessionDirById(grokHome, a.session_id);
    if (!dir) continue;
    const live = Boolean(a.pid && isPidAlive(a.pid));
    if (!live) continue;
    const preKey = dashboardPreKey(a.session_id, dir, {
      live,
      cwd: a.cwd,
      usageKey: uKey,
      configStamp: cfgStamp,
    });
    const skipLoad =
      !options.force &&
      sessionPreCache.get(a.session_id) === preKey &&
      lastSnapById.has(a.session_id);
    work.push({
      sessionId: a.session_id,
      dir,
      cwd: a.cwd,
      pid: a.pid,
      live,
      preKey,
      skipLoad,
    });
  }
  pruneSessionCaches(new Set(work.map((w) => w.sessionId)));

  // Fallback: no live active entries → pickBest once
  if (!work.length) {
    let primary: SessionSnapshot | null = pickFromActiveSessions(grokHome);
    if (!primary) primary = pickBestSession({ grokHome });
    if (!primary) {
      return { title: "◆ grok-hud: no session", session: null };
    }
    writeStatusFiles(primary, usage, grokHome, {
      tmuxSession: resolveTmuxSessionForGrok(primary.pid, grokHome),
      writeGlobal: true,
    });
    lastSnapById.set(primary.sessionId, primary);
    return { title: titleLine(primary, usage), session: primary };
  }

  const preferredPrimaryId =
    pickFromActiveSessions(grokHome)?.sessionId ?? work[0]?.sessionId;

  const targets: SessionSnapshot[] = [];

  for (const w of work) {
    if (w.skipLoad) {
      const cached = lastSnapById.get(w.sessionId)!;
      targets.push(cached);
      continue;
    }

    const snap = loadSnapshotFromDir(w.dir, { active });
    if (!snap?.live) continue;
    lastSnapById.set(snap.sessionId, snap);
    sessionPreCache.set(snap.sessionId, w.preKey);
    targets.push(snap);

    const rKey = sessionRenderKey(snap, uKey);
    const cached = sessionFpCache.get(snap.sessionId);
    if (!options.force && cached && cached.key === rKey) {
      continue; // loaded but content identical → skip write
    }

    const tmuxSession = resolveTmuxSessionForGrok(snap.pid, grokHome);
    const tty = ttyForPid(snap.pid);
    const isPrimary =
      snap.sessionId === preferredPrimaryId || work.length === 1;
    writeStatusFiles(snap, usage, grokHome, {
      tmuxSession,
      ttyPath: tty,
      writeGlobal: isPrimary,
    });
    sessionFpCache.set(snap.sessionId, {
      key: rKey,
      at: Date.now(),
    });

    const title = titleLine(snap, usage);
    if (tty && sessionTitleCache.get(snap.sessionId) !== title) {
      writeOscTitle(tty, title);
      setAppleTerminalTitle(title, { ttyHint: path.basename(tty) });
      sessionTitleCache.set(snap.sessionId, title);
    }
  }

  if (!targets.length) {
    return { title: "◆ grok-hud: no session", session: null };
  }

  const primary =
    targets.find((t) => t.sessionId === preferredPrimaryId) ?? targets[0]!;

  return { title: titleLine(primary, usage), session: primary };
}

export function isDashboardRunning(grokHome = defaultGrokHome()): boolean {
  const p = dashboardPidPath(grokHome);
  try {
    if (!fs.existsSync(p)) return false;
    const pid = Number(fs.readFileSync(p, "utf8").trim());
    if (!Number.isFinite(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    // Confirm it's actually our dashboard (not a recycled pid)
    try {
      const cmd = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
        encoding: "utf8",
        timeout: 1000,
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (!cmd.includes("dashboard") && !cmd.includes("grok-build-hud")) {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Kill every dashboard daemon we can find (prevents multi-writer theme fights). */
export function stopAllDashboardDaemons(grokHome = defaultGrokHome()): number {
  let killed = 0;
  const p = dashboardPidPath(grokHome);
  try {
    if (fs.existsSync(p)) {
      const pid = Number(fs.readFileSync(p, "utf8").trim());
      if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, "SIGTERM");
          killed += 1;
        } catch {
          /* ignore */
        }
      }
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  // Sweep orphans matching our entry pattern
  try {
    // Match "--dashboard" as its own argv token (not "--dashboard-start")
    const out = execFileSync(
      "pgrep",
      ["-f", "grok-build-hud.*(dist/src/index\\.js|bin/grok-build-hud\\.js) --dashboard "],
      {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    for (const line of out.split(/\n/)) {
      const pid = Number(line.trim());
      if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) continue;
      try {
        process.kill(pid, "SIGTERM");
        killed += 1;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no matches */
  }
  return killed;
}

export function stopDashboard(grokHome = defaultGrokHome()): boolean {
  return stopAllDashboardDaemons(grokHome) > 0;
}

/** Fork a detached dashboard daemon if not already running. */
export function ensureDashboardDaemon(options: {
  grokHome?: string;
  entryJs?: string;
  intervalMs?: number;
}): { started: boolean; alreadyRunning: boolean; pid?: number } {
  const grokHome = options.grokHome ?? defaultGrokHome();
  if (isDashboardRunning(grokHome)) {
    return { started: false, alreadyRunning: true };
  }

  // Clean orphans before starting a single writer
  stopAllDashboardDaemons(grokHome);

  const entry =
    options.entryJs ??
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "index.js",
    );
  const interval = options.intervalMs ?? 500;
  const logPath = path.join(grokHome, "hud", "dashboard.log");
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const logFd = fs.openSync(logPath, "a");

  const child = spawn(
    process.execPath,
    [
      entry,
      "--dashboard",
      "--follow-active",
      "--interval",
      String(interval),
      "--grok-home",
      grokHome,
    ],
    {
      detached: true,
      stdio: ["ignore", logFd, logFd],
      env: {
        ...process.env,
        GROK_HUD_THEME: process.env.GROK_HUD_THEME || "auto",
      },
    },
  );
  child.unref();
  if (child.pid) {
    fs.writeFileSync(dashboardPidPath(grokHome), String(child.pid) + "\n");
    return { started: true, alreadyRunning: false, pid: child.pid };
  }
  return { started: false, alreadyRunning: false };
}

/**
 * Open a dedicated Apple Terminal window that only shows the live HUD.
 * Grok itself overwrites its own window title with tool activity — a separate
 * window is the reliable "always visible dashboard" on Terminal.app.
 */
export function openTerminalDashboardWindow(options: {
  entryBin?: string;
  intervalMs?: number;
} = {}): boolean {
  if (process.platform !== "darwin") return false;
  try {
    const bin =
      options.entryBin ??
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "bin",
        "grok-build-hud.js",
      );
    const node = process.execPath;
    const interval = options.intervalMs ?? 2000;
    // clear+redraw dual bars forever; title fixed so user can find the window
    const cmd = `${JSON.stringify(node)} ${JSON.stringify(bin)} --watch --follow-active --no-color --interval ${interval}; echo '[hud] stopped — press enter'; read`;
    const safeCmd = cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const script = `
tell application "Terminal"
  activate
  set tabRef to do script "${safeCmd}"
  delay 0.3
  try
    set custom title of tabRef to "◆ Grok HUD"
  end try
  try
    set custom title of front window to "◆ Grok HUD"
  end try
end tell
`;
    execFileSync("osascript", ["-e", script], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 8000,
    });
    return true;
  } catch {
    return false;
  }
}

export async function runDashboardLoop(options: {
  grokHome?: string;
  intervalMs?: number;
  maxIterations?: number;
  noUsage?: boolean;
  sleep?: (ms: number) => Promise<void>;
  writePid?: boolean;
}): Promise<number> {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const interval = options.intervalMs ?? 500;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  if (options.writePid !== false) {
    fs.mkdirSync(path.join(grokHome, "hud"), { recursive: true });
    fs.writeFileSync(dashboardPidPath(grokHome), String(process.pid) + "\n");
  }

  const cleanup = () => {
    try {
      const p = dashboardPidPath(grokHome);
      if (fs.existsSync(p)) {
        const cur = Number(fs.readFileSync(p, "utf8").trim());
        if (cur === process.pid) fs.unlinkSync(p);
      }
    } catch {
      /* ignore */
    }
  };
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    i += 1;
    try {
      await refreshDashboard({
        grokHome,
        noUsage: options.noUsage,
      });
    } catch {
      /* keep looping */
    }
    if (options.maxIterations && i >= options.maxIterations) {
      cleanup();
      return 0;
    }
    await sleep(interval);
  }
}
