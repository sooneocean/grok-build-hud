/**
 * Parallel Terminal isolation helpers.
 * Each Terminal gets its own tmux session + per-session HUD files.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { defaultGrokHome } from "./session.js";

/** Sanitize for tmux session names / directory names. */
export function sanitizeId(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "x";
}

/** Unique tmux session name — never reuse "grok-hud" (that forced attach). */
export function uniqueTmuxSessionName(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GROK_TMUX_SESSION?.trim()) {
    return sanitizeId(env.GROK_TMUX_SESSION.trim());
  }
  const tty = detectControllingTtyBase(env);
  const stamp = Date.now().toString(36);
  const pid = process.pid;
  const head = tty ? `g${sanitizeId(tty)}` : "g";
  // pid+stamp guarantees two Terminals never collide
  return `${head}-${pid}-${stamp}`.slice(0, 60);
}

export function detectControllingTtyBase(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  try {
    // Prefer explicit; else query this process
    const out = execFileSync("tty", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 500,
    })
      .trim()
      .replace(/^\/dev\//, "");
    if (out && out !== "not a tty") return out;
  } catch {
    /* ignore */
  }
  const t = env.TTY?.replace(/^\/dev\//, "");
  return t || null;
}

export function hudTmuxDir(
  tmuxSession: string,
  grokHome = defaultGrokHome(),
): string {
  return path.join(grokHome, "hud", "tmux", sanitizeId(tmuxSession));
}

export interface TmuxInstanceMeta {
  tmuxSession: string;
  launcherPid: number;
  startedAt: string;
  tty?: string | null;
  grokSessionId?: string;
}

export function writeTmuxInstanceMeta(
  meta: TmuxInstanceMeta,
  grokHome = defaultGrokHome(),
): string {
  const dir = hudTmuxDir(meta.tmuxSession, grokHome);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "meta.json");
  fs.writeFileSync(p, JSON.stringify(meta, null, 2), "utf8");
  return p;
}

export function readTmuxInstanceMeta(
  tmuxSession: string,
  grokHome = defaultGrokHome(),
): TmuxInstanceMeta | null {
  try {
    const p = path.join(hudTmuxDir(tmuxSession, grokHome), "meta.json");
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as TmuxInstanceMeta;
  } catch {
    return null;
  }
}

/** Parent pid of a process (macOS/Linux). */
export function parentPid(pid: number): number | null {
  if (!pid || pid <= 0) return null;
  try {
    const out = execFileSync("ps", ["-o", "ppid=", "-p", String(pid)], {
      encoding: "utf8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** True if target is the ancestor or a descendant of ancestor (walk up from target). */
export function isInProcessTree(
  targetPid: number,
  ancestorPid: number,
): boolean {
  if (!targetPid || !ancestorPid) return false;
  if (targetPid === ancestorPid) return true;
  let pid = targetPid;
  for (let i = 0; i < 40; i++) {
    const pp = parentPid(pid);
    if (!pp || pp <= 1) return false;
    if (pp === ancestorPid) return true;
    pid = pp;
  }
  return false;
}

export interface TmuxPaneRow {
  sessionName: string;
  panePid: number;
}

/** List tmux panes (session + pane shell pid). */
export function listTmuxPanes(): TmuxPaneRow[] {
  try {
    const out = execFileSync(
      "tmux",
      ["list-panes", "-a", "-F", "#{session_name}\t#{pane_pid}"],
      {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (!out) return [];
    const rows: TmuxPaneRow[] = [];
    for (const line of out.split("\n")) {
      const [name, pidS] = line.split("\t");
      const panePid = Number(pidS);
      if (!name || !Number.isFinite(panePid)) continue;
      rows.push({ sessionName: name, panePid });
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * Find which tmux session is running this Grok pid (pane shell is ancestor).
 */
export function findTmuxSessionForPid(grokPid?: number): string | null {
  if (!grokPid || grokPid <= 0) return null;
  const panes = listTmuxPanes();
  for (const p of panes) {
    // grok is child of pane's login shell (or grandchild)
    if (isInProcessTree(grokPid, p.panePid) || grokPid === p.panePid) {
      return p.sessionName;
    }
  }
  return null;
}

/** List instance dirs under hud/tmux/ that look like our sessions. */
export function listHudTmuxSessions(grokHome = defaultGrokHome()): string[] {
  const root = path.join(grokHome, "hud", "tmux");
  try {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}
