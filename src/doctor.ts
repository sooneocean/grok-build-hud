/**
 * grok-hud doctor — local health check (Phase E / 0.9).
 * Never throws; returns structured checks for CLI / tests.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { defaultGrokHome } from "./session.js";
import {
  isDashboardRunning,
  ensureDashboardDaemon,
  refreshDashboard,
  stopDashboard,
  inspectDashboardLog,
  inspectDashboardPidFile,
  clearStaleDashboardState,
  rotateDashboardLogIfNeeded,
  DASHBOARD_LOG_MAX_BYTES,
} from "./dashboard.js";
import {
  loadHudConfig,
  configPath,
  ensureDefaultConfig,
  probeHudConfig,
  repairInvalidHudConfig,
} from "./hud-config.js";
import { packageRoot, installGlobalHooks } from "./install.js";
import { writeTmuxConfFile, applyTmuxStatusBar } from "./tmux-hud.js";

export type CheckLevel = "ok" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  level: CheckLevel;
  title: string;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  summary: string;
}

function which(cmd: string): string | null {
  try {
    const out = execFileSync("which", [cmd], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

function nodeMajor(): number {
  const m = process.versions.node.split(".")[0];
  return Number(m) || 0;
}

function fileAgeMs(p: string, now: number): number | null {
  try {
    if (!fs.existsSync(p)) return null;
    return now - fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

function hasGrokAuth(grokHome: string): boolean {
  const candidates = [
    path.join(grokHome, "auth.json"),
    path.join(grokHome, "credentials.json"),
    path.join(os.homedir(), ".config", "grok", "auth.json"),
  ];
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      if (raw.includes("token") || raw.includes("access")) return true;
      if (raw.trim().length > 20) return true;
    } catch {
      /* continue */
    }
  }
  // env token
  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) return true;
  return false;
}

export function runDoctor(
  options: { grokHome?: string; now?: number } = {},
): DoctorReport {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const now = options.now ?? Date.now();
  const checks: DoctorCheck[] = [];

  // Node
  const major = nodeMajor();
  checks.push({
    id: "node",
    level: major >= 18 ? "ok" : "fail",
    title: "Node.js",
    detail:
      major >= 18
        ? `v${process.versions.node} (≥18)`
        : `v${process.versions.node} — need 18+`,
  });

  // tmux
  const tmux = which("tmux");
  checks.push({
    id: "tmux",
    level: tmux ? "ok" : "warn",
    title: "tmux",
    detail: tmux
      ? tmux
      : "not found — same-window HUD needs tmux (brew install tmux)",
  });

  // CLI on PATH
  const cli = which("grok-hud") || which("grok-build-hud");
  checks.push({
    id: "cli",
    level: cli ? "ok" : "warn",
    title: "CLI on PATH",
    detail: cli ?? "grok-hud not on PATH — run npm link from repo",
  });

  // Build / package
  let pkgVer = "?";
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(packageRoot(), "package.json"), "utf8"),
    ) as { version?: string };
    pkgVer = pkg.version ?? "?";
    const entry = path.join(packageRoot(), "dist", "src", "index.js");
    checks.push({
      id: "build",
      level: fs.existsSync(entry) ? "ok" : "fail",
      title: "Build (dist/)",
      detail: fs.existsSync(entry)
        ? `v${pkgVer} · ${entry}`
        : "dist missing — npm run build",
    });
  } catch (e) {
    checks.push({
      id: "build",
      level: "fail",
      title: "Build (dist/)",
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Config (probe — invalid JSON is fail, not silent preset) (1.8)
  const probe = probeHudConfig(grokHome);
  if (probe.status === "ok") {
    const cfg = probe.cfg;
    checks.push({
      id: "config",
      level: "ok",
      title: "HUD config",
      detail: `${probe.path} · aesthetic=${cfg.aesthetic ?? "classic"} · lang=${cfg.language ?? "en"} · autoDenseBelow=${cfg.autoDenseBelow ?? 0}`,
    });
  } else if (probe.status === "invalid") {
    checks.push({
      id: "config",
      level: "fail",
      title: "HUD config",
      detail: `invalid JSON — ${probe.error} (${probe.path}); runtime falls back to preset until fixed`,
    });
  } else {
    checks.push({
      id: "config",
      level: "warn",
      title: "HUD config",
      detail: `missing ${probe.path} — will create on first settings/save`,
    });
  }

  // Auth
  checks.push({
    id: "auth",
    level: hasGrokAuth(grokHome) ? "ok" : "warn",
    title: "Grok auth",
    detail: hasGrokAuth(grokHome)
      ? "credentials found (quota fetch possible)"
      : "no auth file — run grok login for usage chip",
  });

  // Dashboard pid + lock health (1.8)
  const pidInfo = inspectDashboardPidFile(grokHome);
  const dash = isDashboardRunning(grokHome);
  if (dash) {
    checks.push({
      id: "dashboard",
      level: "ok",
      title: "Dashboard daemon",
      detail: pidInfo.detail,
    });
  } else if (pidInfo.stale) {
    checks.push({
      id: "dashboard",
      level: "warn",
      title: "Dashboard daemon",
      detail: `${pidInfo.detail} — run grok-hud doctor --fix or grok-hud start`,
    });
  } else {
    checks.push({
      id: "dashboard",
      level: "warn",
      title: "Dashboard daemon",
      detail: "not running — grok-hud start or open Terminal with install hook",
    });
  }

  // Dashboard error log (rate-limited refresh failures) (1.8)
  const logInfo = inspectDashboardLog(grokHome, { now, recentMs: 15 * 60_000 });
  if (!logInfo.exists) {
    checks.push({
      id: "dashboard-log",
      level: "ok",
      title: "Dashboard log",
      detail: "no dashboard.log yet (clean)",
    });
  } else if (logInfo.recentErrorCount > 0) {
    const ageS =
      logInfo.lastErrorAgeMs != null
        ? `${Math.round(logInfo.lastErrorAgeMs / 1000)}s ago`
        : "recent";
    checks.push({
      id: "dashboard-log",
      level: "warn",
      title: "Dashboard log",
      detail: `${logInfo.recentErrorCount} refresh error(s) in last 15m (${ageS}) — ${logInfo.path}${logInfo.lastErrorLine ? `: ${logInfo.lastErrorLine}` : ""}`,
    });
  } else {
    // Soft hint if log is large (rotate on --fix / next error append)
    let sizeNote = "";
    try {
      const sz = fs.statSync(logInfo.path).size;
      if (sz >= DASHBOARD_LOG_MAX_BYTES) {
        sizeNote = ` · ${Math.round(sz / 1024)}KB (over rotate threshold — doctor --fix)`;
      }
    } catch {
      /* ignore */
    }
    checks.push({
      id: "dashboard-log",
      level: sizeNote ? "warn" : "ok",
      title: "Dashboard log",
      detail: `${logInfo.path} (no recent refresh errors)${sizeNote}`,
    });
  }

  // Status freshness
  const statusPath = path.join(grokHome, "hud", "status.txt");
  const age = fileAgeMs(statusPath, now);
  if (age == null) {
    checks.push({
      id: "status",
      level: "warn",
      title: "Status files",
      detail: "status.txt missing — start a Grok session or grok-hud status",
    });
  } else if (age > 120_000) {
    checks.push({
      id: "status",
      level: "warn",
      title: "Status files",
      detail: `status.txt stale (${Math.round(age / 1000)}s old)`,
    });
  } else {
    checks.push({
      id: "status",
      level: "ok",
      title: "Status files",
      detail: `status.txt fresh (${Math.round(age / 1000)}s ago)`,
    });
  }

  // Hooks
  const hooksPath = path.join(grokHome, "hooks", "grok-build-hud.json");
  checks.push({
    id: "hooks",
    level: fs.existsSync(hooksPath) ? "ok" : "warn",
    title: "Grok hooks",
    detail: fs.existsSync(hooksPath)
      ? hooksPath
      : "hooks not installed — grok-build-hud --install-dashboard",
  });

  // Plugin (best effort)
  const pluginsDir = path.join(grokHome, "installed-plugins");
  let pluginDetail = "not found under installed-plugins";
  let pluginLevel: CheckLevel = "warn";
  try {
    if (fs.existsSync(pluginsDir)) {
      const dirs = fs
        .readdirSync(pluginsDir)
        .filter((d) => d.startsWith("grok-build-hud"));
      if (dirs.length) {
        const p = path.join(pluginsDir, dirs[0]!, "plugin.json");
        if (fs.existsSync(p)) {
          const pj = JSON.parse(fs.readFileSync(p, "utf8")) as {
            version?: string;
          };
          pluginDetail = `${dirs[0]} v${pj.version ?? "?"} (package ${pkgVer})`;
          pluginLevel =
            pj.version && pkgVer !== "?" && pj.version !== pkgVer
              ? "warn"
              : "ok";
          if (pluginLevel === "warn") {
            pluginDetail += " — version mismatch; re-run install.sh / rsync";
          }
        }
      }
    }
  } catch {
    pluginDetail = "could not read installed-plugins";
  }
  checks.push({
    id: "plugin",
    level: pluginLevel,
    title: "Grok plugin",
    detail: pluginDetail,
  });

  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  const ok = fails === 0;
  const summary =
    fails > 0
      ? `FAIL ${fails} · warn ${warns} · grok-build-hud doctor`
      : warns > 0
        ? `OK with ${warns} warning(s) · grok-build-hud doctor`
        : `All checks passed · grok-build-hud doctor`;

  return { ok, checks, summary };
}

export function formatDoctorReport(report: DoctorReport): string {
  const icon = (l: CheckLevel) =>
    l === "ok" ? "✓" : l === "warn" ? "!" : "✗";
  const lines = [
    report.summary,
    "",
    ...report.checks.map(
      (c) => `  ${icon(c.level)} ${c.title.padEnd(18)} ${c.detail}`,
    ),
    "",
    "Fix hints:",
    "  grok-hud doctor --fix   # safe auto-repair",
    "  npm run build && npm link",
    "  bash scripts/install.sh",
    "  grok-hud start   # dashboard",
    "  grok login       # quota",
    "  brew install tmux",
  ];
  return lines.join("\n");
}

export interface DoctorFixAction {
  id: string;
  ok: boolean;
  detail: string;
}

export interface DoctorFixReport {
  actions: DoctorFixAction[];
  before: DoctorReport;
  after: DoctorReport;
}

/**
 * Safe local repairs only (no brew, no network login, no force-push).
 * - repair / ensure config.json (quarantine invalid JSON)
 * - clear stale dashboard pid/lock
 * - rotate oversized dashboard.log
 * - reinstall hooks if missing
 * - restart dashboard daemon
 * - rewrite tmux conf + apply bar
 * - refresh status files
 */
export async function runDoctorFix(
  options: { grokHome?: string } = {},
): Promise<DoctorFixReport> {
  const grokHome = options.grokHome ?? defaultGrokHome();
  const before = runDoctor({ grokHome });
  const actions: DoctorFixAction[] = [];

  // Config — quarantine invalid JSON, else ensure default (1.9)
  try {
    const repair = repairInvalidHudConfig(grokHome);
    if (repair.repaired) {
      actions.push({
        id: "config",
        ok: true,
        detail: repair.detail,
      });
    } else {
      ensureDefaultConfig(grokHome);
      actions.push({
        id: "config",
        ok: true,
        detail: `config ready: ${configPath(grokHome)}`,
      });
    }
  } catch (e) {
    actions.push({
      id: "config",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Stale pid / lock (1.9)
  try {
    const stale = clearStaleDashboardState(grokHome);
    actions.push({
      id: "stale-state",
      ok: true,
      detail: stale.detail,
    });
  } catch (e) {
    actions.push({
      id: "stale-state",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Log rotate if oversized (1.9)
  try {
    const rot = rotateDashboardLogIfNeeded(grokHome);
    actions.push({
      id: "log-rotate",
      ok: true,
      detail: rot.rotated
        ? `rotated ${rot.size}B → ${rot.archived}`
        : rot.size > 0
          ? `log ${rot.size}B < ${DASHBOARD_LOG_MAX_BYTES}B — no rotate`
          : "no dashboard.log",
    });
  } catch (e) {
    actions.push({
      id: "log-rotate",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Hooks
  try {
    const hooksPath = path.join(grokHome, "hooks", "grok-build-hud.json");
    if (!fs.existsSync(hooksPath)) {
      const { hooksPath: hp } = installGlobalHooks({ grokHome });
      actions.push({
        id: "hooks",
        ok: true,
        detail: `installed hooks → ${hp}`,
      });
    } else {
      actions.push({
        id: "hooks",
        ok: true,
        detail: "hooks already present",
      });
    }
  } catch (e) {
    actions.push({
      id: "hooks",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Tmux conf
  try {
    writeTmuxConfFile(grokHome);
    applyTmuxStatusBar({ grokHome });
    actions.push({
      id: "tmux",
      ok: true,
      detail: "tmux conf written + status bar applied (if inside tmux)",
    });
  } catch (e) {
    actions.push({
      id: "tmux",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Dashboard restart
  try {
    if (isDashboardRunning(grokHome)) {
      stopDashboard(grokHome);
    }
    const entryJs = path.join(packageRoot(), "dist", "src", "index.js");
    if (!fs.existsSync(entryJs)) {
      actions.push({
        id: "dashboard",
        ok: false,
        detail: "dist missing — run npm run build first",
      });
    } else {
      const r = ensureDashboardDaemon({
        grokHome,
        entryJs,
        intervalMs: 500,
      });
      actions.push({
        id: "dashboard",
        ok: Boolean(r.started || r.alreadyRunning),
        detail: r.alreadyRunning
          ? `already running${r.pid != null ? ` pid ${r.pid}` : ""}`
          : r.started
            ? `started${r.pid != null ? ` pid ${r.pid}` : ""}`
            : "daemon did not start",
      });
    }
  } catch (e) {
    actions.push({
      id: "dashboard",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Refresh status once
  try {
    await refreshDashboard({ grokHome, force: true });
    actions.push({
      id: "refresh",
      ok: true,
      detail: "status files refreshed",
    });
  } catch (e) {
    actions.push({
      id: "refresh",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Touch aesthetic defaults if config exists
  try {
    loadHudConfig(grokHome);
    actions.push({
      id: "load",
      ok: true,
      detail: "config reloaded OK",
    });
  } catch (e) {
    actions.push({
      id: "load",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  const after = runDoctor({ grokHome });
  return { actions, before, after };
}

export function formatDoctorFixReport(report: DoctorFixReport): string {
  const lines = [
    "grok-hud doctor --fix",
    "",
    "Actions:",
    ...report.actions.map(
      (a) => `  ${a.ok ? "✓" : "✗"} ${a.id.padEnd(12)} ${a.detail}`,
    ),
    "",
    "After:",
    formatDoctorReport(report.after),
  ];
  return lines.join("\n");
}
