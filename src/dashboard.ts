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
  findSessionDirById,
  loadActiveSessions,
  loadSnapshotFromDir,
  pickBestSession,
} from "./session.js";
import { getCreditUsage } from "./billing.js";
import { writeStatusFiles, formatCompactLine } from "./status.js";
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
 * Apple Terminal: set tab/window custom title so it appears in the title bar.
 * Terminal composes: "cwd — custom title — process — size"
 * We cannot reliably toggle title-display flags on all locales, but custom
 * title is always shown when set on the tab.
 */
export function setAppleTerminalTitle(
  title: string,
  options: { ttyHint?: string | null } = {},
): boolean {
  if (process.platform !== "darwin") return false;
  try {
    const safe = title
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .slice(0, 100);
    const tty = (options.ttyHint || "")
      .replace(/^\/dev\//, "")
      .replace(/"/g, "");
    // Prefer matching tab by tty; else set every Terminal tab/window.
    const script = `
tell application "Terminal"
  set hud to "${safe}"
  set targetTty to "${tty}"
  set matched to false
  if targetTty is not "" then
    repeat with w in windows
      repeat with tb in tabs of w
        try
          set t to tty of tb as string
          if t contains targetTty then
            set custom title of tb to hud
            try
              set custom title of w to hud
            end try
            set matched to true
          end if
        end try
      end repeat
    end repeat
  end if
  if matched is false then
    repeat with w in windows
      try
        set custom title of w to hud
      end try
      repeat with tb in tabs of w
        try
          set custom title of tb to hud
        end try
      end repeat
    end repeat
  end if
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

export async function refreshDashboard(options: {
  grokHome?: string;
  noUsage?: boolean;
}): Promise<{ title: string; session: SessionSnapshot | null }> {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const active = loadActiveSessions(grokHome);
  let session: SessionSnapshot | null = null;

  for (const a of active) {
    const dir = findSessionDirById(grokHome, a.session_id);
    if (!dir) continue;
    const snap = loadSnapshotFromDir(dir, { active });
    if (snap?.live) {
      session = snap;
      break;
    }
    if (!session && snap) session = snap;
  }
  if (!session) session = pickBestSession({ grokHome });

  if (!session) {
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

  // Theme follows Grok [ui].theme; re-apply tmux chrome when palette flips
  const { resolveTheme } = await import("./theme.js");
  const theme = resolveTheme(undefined, process.env, { grokHome });
  writeStatusFiles(session, usage, grokHome);
  try {
    const stamp = path.join(grokHome, "hud", ".last-theme");
    const prev = fs.existsSync(stamp)
      ? fs.readFileSync(stamp, "utf8").trim()
      : "";
    if (prev !== theme.name) {
      fs.writeFileSync(stamp, theme.name + "\n", "utf8");
      const { writeTmuxConfFile, applyTmuxStatusBar } = await import(
        "./tmux-hud.js"
      );
      writeTmuxConfFile(grokHome);
      applyTmuxStatusBar({ grokHome });
    }
  } catch {
    /* ignore */
  }
  const title = titleLine(session, usage);

  // 1) OSC into Grok's TTY (updates process title component)
  const tty = ttyForPid(session.pid);
  if (tty) writeOscTitle(tty, title);

  // 2) Apple Terminal custom title (always visible as middle segment of window title)
  //    e.g. "0717 — ◆ ctx 44% | quota 23% — zsh — 101×50"
  const ttyHint = tty ? path.basename(tty) : null;
  setAppleTerminalTitle(title, { ttyHint });

  // tmux-status.txt is written by writeStatusFiles (formatTmuxStatusLine)

  // If already inside tmux (same-window mode), keep status bar config applied
  if (process.env.TMUX) {
    try {
      execFileSync(
        "tmux",
        [
          "set",
          "-g",
          "status-right",
          `#(cat ${path.join(grokHome, "hud", "tmux-status.txt")} 2>/dev/null)`,
        ],
        { stdio: "ignore", timeout: 1000 },
      );
    } catch {
      /* ignore */
    }
  }

  return { title, session };
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
