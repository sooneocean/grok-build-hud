#!/usr/bin/env node
import {
  pickBestSession,
  discoverSessions,
  defaultGrokHome,
  findSessionDirById,
  loadActiveSessions,
  loadSnapshotFromDir,
} from "./session.js";
import { getCreditUsage, unavailableUsage } from "./billing.js";
import { renderHud, renderJson } from "./render.js";
import { loadConfig } from "./config.js";
import { writeStatusFiles } from "./status.js";
import {
  installGlobalHooks,
  uninstallGlobalHooks,
  packageRoot,
} from "./install.js";
import { installDashboard, uninstallDashboard } from "./install-dashboard.js";
import {
  runDashboardLoop,
  ensureDashboardDaemon,
  stopDashboard,
  isDashboardRunning,
  refreshDashboard,
} from "./dashboard.js";
import {
  execGrokInSameWindowTmux,
  applyTmuxStatusBar,
  installSameWindowLauncher,
  isInsideTmux,
  writeTmuxConfFile,
} from "./tmux-hud.js";
import {
  persistTheme,
  resolveTheme,
  resolveThemeMode,
  readGrokUiConfig,
  clearAppearanceCache,
} from "./theme.js";
import {
  applyPreset,
  saveHudConfig,
  loadHudConfig,
  type HudPreset,
} from "./hud-config.js";
import type { SessionSnapshot, UsageSnapshot } from "./types.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

export { contextPercentFromSignals, renderBar, formatTokenCount } from "./bar.js";
export { parseUpdatesLines, formatToolLine } from "./activity.js";
export { normalizeBillingPayload } from "./billing.js";
export {
  loadSnapshotFromDir,
  pickBestSession,
  discoverSessions,
  findSessionDirById,
} from "./session.js";
export { renderHud, renderJson } from "./render.js";
export { runHookTick } from "./hook.js";
export { writeStatusFiles, formatCompactLine } from "./status.js";
export { installGlobalHooks, uninstallGlobalHooks } from "./install.js";
export { installDashboard, uninstallDashboard } from "./install-dashboard.js";

export interface CliOptions {
  watch: boolean;
  once: boolean;
  tmux: boolean;
  json: boolean;
  all: boolean;
  noColor: boolean;
  cwd?: string;
  session?: string;
  sessionDir?: string;
  grokHome?: string;
  refreshMs?: number;
  maxIterations?: number;
  help: boolean;
  version: boolean;
  noUsage: boolean;
  installHooks: boolean;
  uninstallHooks: boolean;
  tick: boolean;
  followActive: boolean;
  installDashboard: boolean;
  uninstallDashboard: boolean;
  dashboard: boolean;
  dashboardStart: boolean;
  dashboardStop: boolean;
  dashboardWindow: boolean;
  runInTerminal: boolean;
  theme?: string;
  preset?: string;
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    watch: false,
    once: true,
    tmux: false,
    json: false,
    all: false,
    noColor: false,
    help: false,
    version: false,
    noUsage: false,
    installHooks: false,
    uninstallHooks: false,
    tick: false,
    followActive: false,
    installDashboard: false,
    uninstallDashboard: false,
    dashboard: false,
    dashboardStart: false,
    dashboardStop: false,
    dashboardWindow: false,
    runInTerminal: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-w":
      case "--watch":
        opts.watch = true;
        opts.once = false;
        break;
      case "--once":
        opts.once = true;
        opts.watch = false;
        break;
      case "--tmux":
        opts.tmux = true;
        break;
      case "--json":
        opts.json = true;
        break;
      case "--all":
        opts.all = true;
        break;
      case "--no-color":
      case "--plain":
        opts.noColor = true;
        break;
      case "--no-usage":
        opts.noUsage = true;
        break;
      case "--cwd":
        opts.cwd = argv[++i];
        break;
      case "--session":
        opts.session = argv[++i];
        break;
      case "--session-dir":
        opts.sessionDir = argv[++i];
        break;
      case "--grok-home":
        opts.grokHome = argv[++i];
        break;
      case "--interval":
      case "--refresh-ms":
        opts.refreshMs = Number(argv[++i]);
        break;
      case "--max-iterations":
        opts.maxIterations = Number(argv[++i]);
        break;
      case "--install-hooks":
      case "--install":
        opts.installHooks = true;
        break;
      case "--uninstall-hooks":
      case "--uninstall":
        opts.uninstallHooks = true;
        break;
      case "--tick":
        opts.tick = true;
        opts.noUsage = true;
        break;
      case "--follow-active":
        opts.followActive = true;
        break;
      case "--install-dashboard":
        opts.installDashboard = true;
        break;
      case "--uninstall-dashboard":
        opts.uninstallDashboard = true;
        break;
      case "--dashboard":
        opts.dashboard = true;
        opts.once = false;
        break;
      case "--dashboard-start":
        opts.dashboardStart = true;
        break;
      case "--dashboard-stop":
        opts.dashboardStop = true;
        break;
      case "--dashboard-window":
      case "--open-window":
        // deprecated / rejected by user — ignore, prefer same-window tmux
        opts.dashboardWindow = false;
        break;
      case "--run-in-terminal":
      case "--run":
        opts.runInTerminal = true;
        break;
      case "--theme":
        opts.theme = argv[++i];
        break;
      case "--preset":
        opts.preset = argv[++i];
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      case "-V":
      case "--version":
        opts.version = true;
        break;
      default:
        if (arg.startsWith("-")) {
          // unknown flag: ignore softly
        }
        break;
    }
  }
  return opts;
}

export function helpText(): string {
  return `grok-build-hud — live context + quota in the SAME Terminal window

Same-window mode (recommended, no second window):
  grok-hud-run
  # or:  grok-build-hud --run
  # Starts Grok inside this tab with a permanent BOTTOM status bar:
  #   ctx 44% │ quota 23% │ GrokBuild 10% │ t8 │ tools 144

Install once:
  grok-build-hud --install-dashboard

Then:
  grok-hud-run          # start Grok + bottom bar (same window)
  grok-hud status       # print full dual bars once
  grok-hud stop         # stop background updater
  grok-build-hud --theme auto              # follow Grok [ui].theme
  grok-build-hud --preset full|essential|minimal   # Claude-HUD presets
  grok-hud-run                             # same-window Grok + multi-line HUD

Claude HUD users: see MIGRATION-FROM-CLAUDE.md
`;
}

async function resolveUsage(
  grokHome: string,
  opts: CliOptions,
  cfg: ReturnType<typeof loadConfig>,
): Promise<UsageSnapshot> {
  if (opts.noUsage || !cfg.showUsage) {
    return unavailableUsage("usage disabled");
  }
  try {
    return await getCreditUsage(grokHome, {
      cacheTtlMs: cfg.usageCacheTtlMs,
      enabled: true,
    });
  } catch {
    return unavailableUsage("usage unavailable");
  }
}

function printFrame(
  sessions: SessionSnapshot[],
  usage: UsageSnapshot,
  opts: CliOptions,
  cfg: ReturnType<typeof loadConfig>,
  out: (s: string) => void,
): void {
  if (!sessions.length) {
    out("No Grok Build sessions found under grok home.");
    return;
  }
  const list = opts.all ? sessions : [sessions[0]!];
  const chunks: string[] = [];
  for (const s of list) {
    if (opts.json) {
      chunks.push(renderJson(s, usage));
    } else {
      chunks.push(
        renderHud(s, usage, {
          color: !opts.noColor && !opts.tmux,
          tmux: opts.tmux,
          pathLevels: cfg.pathLevels,
          warningThreshold: cfg.warningThreshold,
          criticalThreshold: cfg.criticalThreshold,
        }),
      );
    }
  }
  out(chunks.join(opts.json ? "\n" : "\n\n"));
}

export async function runCli(
  argv: string[],
  io: {
    stdout?: (s: string) => void;
    stderr?: (s: string) => void;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<number> {
  const out = io.stdout ?? ((s: string) => process.stdout.write(s + (s.endsWith("\n") ? "" : "\n")));
  const err = io.stderr ?? ((s: string) => process.stderr.write(s + "\n"));
  const sleep =
    io.sleep ??
    ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const opts = parseArgs(argv);
  const cfg = loadConfig();

  if (opts.help) {
    out(helpText());
    return 0;
  }
  if (opts.version) {
    out("0.2.0");
    return 0;
  }

  if (opts.preset) {
    const p = opts.preset.toLowerCase();
    if (p !== "full" && p !== "essential" && p !== "minimal") {
      err("Preset must be: full | essential | minimal");
      return 1;
    }
    const cfg = applyPreset(p as HudPreset);
    // keep readability defaults when applying presets
    cfg.bold = true;
    cfg.barWidth = Math.max(cfg.barWidth ?? 12, 12);
    const saved = saveHudConfig(cfg, opts.grokHome ?? defaultGrokHome());
    writeTmuxConfFile(opts.grokHome);
    applyTmuxStatusBar({ grokHome: opts.grokHome });
    await refreshDashboard({ grokHome: opts.grokHome });
    out(
      `HUD preset → ${p} (${cfg.statusLines} status row(s), bold, barWidth=${cfg.barWidth})\n  config: ${saved}\n` +
        `Claude HUD map: Full≈full, Essential≈essential, Minimal≈minimal`,
    );
    return 0;
  }

  if (opts.theme) {
    const mode = resolveThemeMode(opts.theme);
    persistTheme(mode);
    process.env.GROK_HUD_THEME = mode;
    clearAppearanceCache();
    const grokHome = opts.grokHome ?? defaultGrokHome();
    const ui = readGrokUiConfig(grokHome);
    const t = resolveTheme(mode, process.env, { grokHome });
    writeTmuxConfFile(grokHome);
    applyTmuxStatusBar({ grokHome });
    await refreshDashboard({ grokHome });
    stopDashboard(grokHome);
    ensureDashboardDaemon({
      grokHome,
      entryJs: path.join(packageRoot(), "dist", "src", "index.js"),
      intervalMs: 500,
    });
    if (mode === "auto") {
      out(
        `HUD follows Grok theme: [ui] theme="${ui.theme}" → palette "${t.name}"\n` +
          `Change with /theme inside Grok; HUD updates within ~1s.\n` +
          `Force lock: grok-build-hud --theme tokyonight|grokday|light|dark`,
      );
    } else {
      out(
        `Theme locked to "${t.name}". Use --theme auto to follow Grok [ui].theme again.`,
      );
    }
    return 0;
  }

  if (opts.installDashboard) {
    try {
      const r = installDashboard({
        grokHome: opts.grokHome,
        startDaemon: true,
      });
      const launchers = installSameWindowLauncher();
      out("Installed SAME-WINDOW dashboard (no second window):");
      out(`  start:    ${launchers.runPath}`);
      out(`           → run:  grok-hud-run`);
      out(`  also:     ${launchers.grokWrapPath}`);
      out(`  hooks:    ${r.hooksPath}`);
      out(`  tmux cfg: ${r.tmuxConf}`);
      if (r.launchAgent) out(`  launchd:  ${r.launchAgent} (file updater)`);
      out(
        `  daemon:   ${r.daemon.alreadyRunning ? "already running" : r.daemon.started ? `started pid ${r.daemon.pid}` : "not started"}`,
      );
      await refreshDashboard({ grokHome: opts.grokHome });
      if (isInsideTmux()) {
        applyTmuxStatusBar({ grokHome: opts.grokHome });
        out("\nAlready inside tmux — status bar applied to THIS window.");
      } else {
        out(
          "\n★ To show the bar in THIS Terminal window:\n  1. End current Grok session (/quit)\n  2. Run:  grok-hud-run\n  Bottom line will always show ctx + quota — no second window.",
        );
      }
      return 0;
    } catch (e) {
      err(e instanceof Error ? e.message : String(e));
      return 1;
    }
  }

  if (opts.runInTerminal) {
    ensureDashboardDaemon({
      grokHome: opts.grokHome,
      entryJs: path.join(packageRoot(), "dist", "src", "index.js"),
      intervalMs: 500,
    });
    await refreshDashboard({ grokHome: opts.grokHome });
    // never returns
    execGrokInSameWindowTmux({
      grokHome: opts.grokHome,
      extraGrokArgs: [],
    });
    return 0;
  }

  if (opts.uninstallDashboard) {
    uninstallDashboard({ grokHome: opts.grokHome });
    uninstallGlobalHooks(opts.grokHome);
    out("Dashboard uninstalled (daemon stopped, LaunchAgent removed).");
    return 0;
  }

  if (opts.dashboardStop) {
    const ok = stopDashboard(opts.grokHome);
    out(ok ? "Dashboard daemon stopped." : "No dashboard daemon was running.");
    return 0;
  }

  if (opts.dashboardStart) {
    const r = ensureDashboardDaemon({
      grokHome: opts.grokHome,
      entryJs: path.join(packageRoot(), "dist", "src", "index.js"),
      intervalMs: opts.refreshMs ?? 2000,
    });
    if (r.alreadyRunning) out("Dashboard already running.");
    else if (r.started) out(`Dashboard started (pid ${r.pid}).`);
    else out("Failed to start dashboard.");
    await refreshDashboard({ grokHome: opts.grokHome });
    return r.started || r.alreadyRunning ? 0 : 1;
  }

  if (opts.dashboard) {
    return runDashboardLoop({
      grokHome: opts.grokHome,
      intervalMs: opts.refreshMs ?? 2000,
      maxIterations: opts.maxIterations,
      noUsage: opts.noUsage,
      writePid: true,
    });
  }

  if (opts.installHooks) {
    try {
      const { hooksPath, hookJs } = installGlobalHooks({
        grokHome: opts.grokHome,
        root: packageRoot(),
      });
      // also ensure dashboard daemon for title bar
      ensureDashboardDaemon({
        grokHome: opts.grokHome,
        entryJs: path.join(packageRoot(), "dist", "src", "index.js"),
      });
      out(`Installed live HUD hooks:\n  ${hooksPath}\n  entry: ${hookJs}`);
      out(
        "\nNext: restart this Grok session (or open /hooks and press r to reload).\nThen keep working — after each turn you should see [hud] annotations in scrollback.",
      );
      return 0;
    } catch (e) {
      err(e instanceof Error ? e.message : String(e));
      return 1;
    }
  }

  if (opts.uninstallHooks) {
    const { removed, hooksPath } = uninstallGlobalHooks(opts.grokHome);
    out(removed ? `Removed ${hooksPath}` : `No hooks file at ${hooksPath}`);
    return 0;
  }

  const grokHome = opts.grokHome ?? defaultGrokHome();
  const discoverOpts = {
    grokHome,
    sessionId: opts.session,
    cwd: opts.cwd,
    sessionDir: opts.sessionDir,
  };

  const resolveSessions = (): SessionSnapshot[] => {
    if (opts.sessionDir) {
      const one = pickBestSession(discoverOpts);
      return one ? [one] : [];
    }
    if (opts.followActive || (!opts.cwd && !opts.session)) {
      // Prefer any live active session first
      const active = loadActiveSessions(grokHome);
      const liveSnaps: SessionSnapshot[] = [];
      for (const a of active) {
        const dir = findSessionDirById(grokHome, a.session_id);
        if (!dir) continue;
        const snap = loadSnapshotFromDir(dir, { active });
        if (snap) liveSnaps.push(snap);
      }
      if (liveSnaps.length) {
        if (opts.cwd) {
          const matched = liveSnaps.filter((s) =>
            s.cwd ? s.cwd === opts.cwd || s.cwd.includes(opts.cwd!) : false,
          );
          // use path equality via discover as fallback
          const viaCwd = discoverSessions({ ...discoverOpts, cwd: opts.cwd });
          if (viaCwd.length) return viaCwd;
          if (matched.length) return matched;
        }
        if (opts.session) {
          const m = liveSnaps.filter((s) => s.sessionId === opts.session);
          if (m.length) return m;
        }
        if (!opts.cwd && !opts.session) return liveSnaps;
      }
    }
    return discoverSessions(discoverOpts);
  };

  const renderOnce = async (): Promise<number> => {
    const sessions = resolveSessions();
    const usage = await resolveUsage(grokHome, opts, cfg);
    if (!sessions.length) {
      err("grok-build-hud: no sessions found");
      printFrame([], usage, opts, cfg, out);
      return 1;
    }
    // Always refresh status files so external readers stay current
    try {
      writeStatusFiles(sessions[0]!, opts.noUsage ? null : usage, grokHome);
    } catch {
      /* ignore */
    }
    if (opts.tick) {
      out(writeStatusFiles(sessions[0]!, null, grokHome).compact);
      return 0;
    }
    printFrame(sessions, usage, opts, cfg, out);
    return 0;
  };

  if (opts.watch) {
    const interval = opts.refreshMs && opts.refreshMs > 0 ? opts.refreshMs : cfg.refreshMs;
    let i = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      i += 1;
      if (!opts.tmux && !opts.json && process.stdout.isTTY) {
        // clear screen lightly for watch
        process.stdout.write("\x1b[2J\x1b[H");
      }
      await renderOnce();
      if (opts.maxIterations && i >= opts.maxIterations) {
        return 0;
      }
      await sleep(interval);
    }
  }

  return renderOnce();
}

// Direct `node dist/src/index.js ...` entry. When imported by tests, argv[1]
// is the test file path, so this block does not run.
function isDirectCliRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectCliRun()) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exit(typeof code === "number" ? code : 0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

