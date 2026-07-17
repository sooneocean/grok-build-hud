/**
 * Grok Build hook entry — runs on SessionStart / PostToolUse / Stop / UserPromptSubmit.
 * Writes live status files and prints a compact line to stderr so TUI scrollback
 * annotations show context + quota while you work (plugin-style live stats).
 */
import fs from "node:fs";
import path from "node:path";
import {
  defaultGrokHome,
  findSessionDirById,
  loadActiveSessions,
  loadSnapshotFromDir,
  pickBestSession,
  pickFromActiveSessions,
} from "./session.js";
import { writeStatusFiles } from "./status.js";
import { getCreditUsage } from "./billing.js";
import { ensureDashboardDaemon } from "./dashboard.js";
import { fileURLToPath } from "node:url";

export interface HookPayload {
  sessionId?: string;
  cwd?: string;
  workspaceRoot?: string;
  hookEventName?: string;
  [key: string]: unknown;
}

export function readStdinSync(): string {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function parseHookPayload(raw: string): HookPayload {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as HookPayload;
  } catch {
    return {};
  }
}

export function resolveSessionForHook(
  payload: HookPayload,
  env: NodeJS.ProcessEnv = process.env,
  grokHome = defaultGrokHome(),
): ReturnType<typeof loadSnapshotFromDir> {
  const sessionId =
    env.GROK_SESSION_ID?.trim() ||
    payload.sessionId ||
    undefined;
  const cwd =
    env.GROK_WORKSPACE_ROOT?.trim() ||
    env.CLAUDE_PROJECT_DIR?.trim() ||
    payload.workspaceRoot ||
    payload.cwd ||
    undefined;

  const active = loadActiveSessions(grokHome);

  if (sessionId) {
    const dir = findSessionDirById(grokHome, sessionId);
    if (dir) {
      return loadSnapshotFromDir(dir, { active });
    }
  }

  // Prefer newest live active session matching cwd (not first-in-list)
  if (cwd) {
    const hit =
      pickFromActiveSessions(grokHome, { cwd }) ??
      pickBestSession({ grokHome, cwd });
    if (hit) return hit;
  }

  // Newest live session among active tabs
  const fromActive = pickFromActiveSessions(grokHome);
  if (fromActive) return fromActive;

  return pickBestSession({ grokHome });
}

/** Throttle PostToolUse floods so we don't spam scrollback. */
export function shouldEmitAnnotation(
  event: string,
  grokHome = defaultGrokHome(),
  minIntervalMs = 4000,
): boolean {
  // Always show on turn boundaries / prompt / session start
  if (
    event === "stop" ||
    event === "Stop" ||
    event === "session_start" ||
    event === "SessionStart" ||
    event === "user_prompt_submit" ||
    event === "UserPromptSubmit" ||
    event === "session_end" ||
    event === "SessionEnd"
  ) {
    return true;
  }
  const stampPath = path.join(hudThrottlePath(grokHome));
  try {
    fs.mkdirSync(path.dirname(stampPath), { recursive: true });
    if (fs.existsSync(stampPath)) {
      const prev = Number(fs.readFileSync(stampPath, "utf8"));
      if (Number.isFinite(prev) && Date.now() - prev < minIntervalMs) {
        return false;
      }
    }
    fs.writeFileSync(stampPath, String(Date.now()), "utf8");
  } catch {
    return true;
  }
  return true;
}

function hudThrottlePath(grokHome: string): string {
  return path.join(grokHome, "hud", ".annotate-throttle");
}

export async function runHookTick(
  options: {
    payloadRaw?: string;
    env?: NodeJS.ProcessEnv;
    grokHome?: string;
    /** force annotation even if throttled */
    forceAnnotate?: boolean;
    /** skip network quota fetch (tests) */
    noUsage?: boolean;
  } = {},
): Promise<{ code: number; compact?: string; annotated: boolean }> {
  const env = options.env ?? process.env;
  const grokHome = options.grokHome ?? defaultGrokHome();
  const raw = options.payloadRaw ?? readStdinSync();
  const payload = parseHookPayload(raw);
  const event =
    env.GROK_HOOK_EVENT ||
    payload.hookEventName ||
    "unknown";

  try {
    const snap = resolveSessionForHook(payload, env, grokHome);
    if (!snap) {
      // Still exit 0 — never block the agent
      return { code: 0, annotated: false };
    }

    // Keep title-bar dashboard alive (no-op if already running)
    try {
      const entryJs = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "index.js",
      );
      ensureDashboardDaemon({ grokHome, entryJs, intervalMs: 2000 });
    } catch {
      /* ignore */
    }

    // Fetch quota (disk-cached ~60s so hooks stay fast)
    let usage = null;
    if (!options.noUsage && env.GROK_HUD_NO_USAGE !== "1") {
      try {
        usage = await getCreditUsage(grokHome, {
          cacheTtlMs: 60_000,
          enabled: true,
        });
      } catch {
        usage = null;
      }
    }

    // Bind to THIS Terminal's tmux instance when env is set (set by grok wrap).
    // Avoid overwriting global status with a stale high-ctx session from another tab
    // when this hook is for a brand-new session.
    const tmuxSession =
      env.GROK_HUD_TMUX_SESSION?.trim() ||
      env.GROK_TMUX_SESSION?.trim() ||
      null;
    const written = writeStatusFiles(snap, usage, grokHome, {
      tmuxSession,
      // Always refresh global for CLI `grok-hud status`, but per-tmux is authoritative in UI
      writeGlobal: true,
    });
    const annotate =
      options.forceAnnotate || shouldEmitAnnotation(String(event), grokHome);
    if (annotate) {
      // stderr shows up in Grok hook scrollback annotations
      process.stderr.write(written.compact + "\n");
      // Also print dual-bar block on Stop / SessionStart for stronger visibility
      if (
        /stop|session_start|SessionStart|UserPromptSubmit|user_prompt/i.test(
          String(event),
        )
      ) {
        process.stderr.write(written.full + "\n");
      }
    }
    return { code: 0, compact: written.compact, annotated: annotate };
  } catch (e) {
    try {
      process.stderr.write(
        `[hud] error: ${e instanceof Error ? e.message : String(e)}\n`,
      );
    } catch {
      /* ignore */
    }
    return { code: 0, annotated: false };
  }
}

// Direct run as hook command
function isDirect(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirect()) {
  runHookTick()
    .then((result) => process.exit(result.code))
    .catch(() => process.exit(0));
}
