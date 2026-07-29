/**
 * CLI / watch plain HUD rendering.
 * Canonical multi-line layout lives in render/compose.ts — this file only
 * applies optional ANSI color and thin tmux one-liners.
 */
import { projectLabel, renderBar } from "./bar.js";
import {
  loadHudConfig,
  type HudDisplayConfig,
} from "./hud-config.js";
import {
  composeHudText,
  displayModel,
} from "./render/compose.js";
import type {
  RenderOptions,
  SessionSnapshot,
  UsageSnapshot,
} from "./types.js";

export type RenderHudOptions = Partial<RenderOptions> & {
  /** Pin display config (tests / CLI with --grok-home). */
  cfg?: HudDisplayConfig;
  grokHome?: string;
};

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function colorize(
  text: string,
  color: string | null,
  enabled: boolean,
): string {
  if (!enabled || !color) return text;
  return `${color}${text}${ANSI.reset}`;
}

function severityColor(percent: number, opts: RenderOptions): string {
  if (percent >= opts.criticalThreshold) return ANSI.red;
  if (percent >= opts.warningThreshold) return ANSI.yellow;
  return ANSI.green;
}

function cfgFromRenderOpts(opts: RenderHudOptions): HudDisplayConfig {
  const base = opts.cfg ?? loadHudConfig(opts.grokHome);
  return {
    ...base,
    pathLevels: (opts.pathLevels === 1 || opts.pathLevels === 2 || opts.pathLevels === 3
      ? opts.pathLevels
      : base.pathLevels) as 1 | 2 | 3,
    lineLayout: opts.compact ? "compact" : base.lineLayout,
    warningThreshold: opts.warningThreshold ?? base.warningThreshold,
    criticalThreshold: opts.criticalThreshold ?? base.criticalThreshold,
  };
}

/**
 * Multi-line HUD text for CLI --once / watch.
 * Uses the same compose pipeline as status.txt (single source of truth).
 */
export function renderHud(
  session: SessionSnapshot,
  usage: UsageSnapshot | null,
  opts: RenderHudOptions = {},
): string {
  const options: RenderOptions = {
    color: opts.color ?? true,
    tmux: opts.tmux ?? false,
    compact: opts.compact ?? false,
    pathLevels: opts.pathLevels ?? 2,
    warningThreshold: opts.warningThreshold ?? 70,
    criticalThreshold: opts.criticalThreshold ?? 90,
  };

  if (options.tmux) {
    return renderTmux(session, usage, options);
  }

  const cfg = cfgFromRenderOpts(opts);
  const plain = composeHudText(session, usage, cfg);
  if (!options.color) return plain;

  // Light ANSI: colour context % on the metrics line when present
  return plain
    .split("\n")
    .map((line, i) => {
      if (i !== 1) return line;
      const pct = Math.round(session.contextPercent);
      const bar = renderBar(session.contextPercent);
      const coloredBar = colorize(bar, severityColor(session.contextPercent, options), true);
      if (line.includes(bar)) {
        return line.replace(bar, coloredBar).replace(
          `${pct}%`,
          colorize(`${pct}%`, severityColor(session.contextPercent, options), true),
        );
      }
      return line;
    })
    .join("\n");
}

export function renderTmux(
  session: SessionSnapshot,
  usage: UsageSnapshot | null,
  opts: RenderOptions,
): string {
  const pct = Math.round(session.contextPercent);
  const project = projectLabel(session.cwd, opts.pathLevels);
  const u =
    usage?.available && usage.percent != null
      ? ` u${Math.round(usage.percent)}%`
      : "";
  return `ctx ${pct}%${u} ${displayModel(session.model)} ${project}`;
}

export function renderJson(
  session: SessionSnapshot,
  usage: UsageSnapshot | null,
): string {
  return JSON.stringify(
    {
      sessionId: session.sessionId,
      model: session.model,
      cwd: session.cwd,
      live: session.live,
      contextPercent: session.contextPercent,
      contextTokensUsed: session.contextTokensUsed,
      contextWindowTokens: session.contextWindowTokens,
      turnCount: session.turnCount,
      toolCallCount: session.toolCallCount,
      tools: session.tools,
      agents: session.agents,
      usage,
    },
    null,
    2,
  );
}
