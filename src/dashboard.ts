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
} from "./session.js";
import { getCreditUsage } from "./billing.js";
import { writeStatusFiles, formatCompactLine } from "./status.js";
import { findTmuxSessionForPid } from "./multi-session.js";
import type { SessionSnapshot, UsageSnapshot } from "./types.js";

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

export async function refreshDashboard(options: {
  grokHome?: string;
  noUsage?: boolean;
}): Promise<{ title: string; session: SessionSnapshot | null }> {
  const grokHome = options.grokHome ?? defaultGrokHome();
  // Parallel Terminals: update EVERY live session independently.
  // Global "primary" = most recently active (for status.json / hooks fallback).
  let primary: SessionSnapshot | null = pickFromActiveSessions(grokHome);
  if (!primary) primary = pickBestSession({ grokHome });

  const live = listLiveSessions(grokHome);
  const targets =
    live.length > 0 ? live : primary ? [primary] : [];

  if (!targets.length) {
    return { title: "◆ grok-hud: no session", session: null };
  }

  let usage: UsageSnapshot | null = null;
  if (!options.noUsage) {
    try {
      usage = await getCreditUsage(grokHome, { cacheTtlMs: 60_000 });
    } catch {
      usage = null;
    }
  }

  // Theme always follows Grok [ui].theme (auto → OS light/dark maps).
  // Fingerprint includes mapping + system appearance so /theme and OS toggle re-paint.
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
    }
  } catch {
    /* ignore */
  }

  // Write per-tmux-session status so each Terminal bar shows ITS own Grok
  // Layout adapts to each window's client width.
  for (const snap of targets) {
    const tmuxSession = findTmuxSessionForPid(snap.pid);
    const tty = ttyForPid(snap.pid);
    const isPrimary =
      primary != null && snap.sessionId === primary.sessionId;
    writeStatusFiles(snap, usage, grokHome, {
      tmuxSession,
      ttyPath: tty,
      // Only primary overwrites global status.* (hooks / grok-hud status)
      writeGlobal: isPrimary || targets.length === 1,
    });

    const title = titleLine(snap, usage);
    if (tty) {
      writeOscTitle(tty, title);
      setAppleTerminalTitle(title, { ttyHint: path.basename(tty) });
    }
  }

  // If somehow no primary write happened, write one
  if (primary && !targets.some((t) => t.sessionId === primary!.sessionId)) {
    writeStatusFiles(primary, usage, grokHome, {
      tmuxSession: findTmuxSessionForPid(primary.pid),
      writeGlobal: true,
    });
  }

  const session = primary ?? targets[0]!;
  return { title: titleLine(session, usage), session };
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
