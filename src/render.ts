import {
  formatDuration,
  formatTokenCount,
  projectLabel,
  renderBar,
} from "./bar.js";
import { formatToolLine } from "./activity.js";
import { loadHudConfig } from "./hud-config.js";
import { stringsFromConfig } from "./i18n.js";
import { formatTokenBreakdownLine } from "./token-usage.js";
import type {
  RenderOptions,
  SessionSnapshot,
  UsageSnapshot,
} from "./types.js";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

function colorize(
  text: string,
  color: string | null,
  enabled: boolean,
): string {
  if (!enabled || !color) return text;
  return `${color}${text}${ANSI.reset}`;
}

function severityColor(
  percent: number,
  opts: RenderOptions,
): string {
  if (percent >= opts.criticalThreshold) return ANSI.red;
  if (percent >= opts.warningThreshold) return ANSI.yellow;
  return ANSI.green;
}

export function renderHud(
  session: SessionSnapshot,
  usage: UsageSnapshot | null,
  opts: Partial<RenderOptions> = {},
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

  const c = options.color;
  const L = stringsFromConfig(loadHudConfig());
  const model = colorize(displayModel(session.model), ANSI.cyan, c);
  const project = projectLabel(session.cwd, options.pathLevels);
  const branchPart = session.branch
    ? ` git:(${session.branch}${session.gitDirty ? "*" : ""})`
    : "";
  const live = session.live
    ? colorize(`● ${L.live}`, ANSI.green, c)
    : colorize(`○ ${L.stale}`, ANSI.dim, c);

  const line1 = `[${model}] │ ${project}${branchPart} │ ${live}`;

  const pct = Math.round(session.contextPercent);
  const barColor = severityColor(session.contextPercent, options);
  const bar = colorize(renderBar(session.contextPercent), barColor, c);
  const tokenPart =
    session.contextWindowTokens > 0
      ? ` (${formatTokenCount(session.contextTokensUsed)}/${formatTokenCount(session.contextWindowTokens)})`
      : "";
  const ctxLabel = colorize(L.ctx, ANSI.bold, c);
  const meta: string[] = [];
  if (session.durationSeconds > 0) {
    meta.push(formatDuration(session.durationSeconds));
  }
  if (session.turnCount > 0) meta.push(`${L.turn}${session.turnCount}`);
  if (session.toolCallCount > 0) meta.push(`${L.tools}${session.toolCallCount}`);
  const tokLine = session.lastTurnTokens
    ? formatTokenBreakdownLine(session.lastTurnTokens, { mode: "exact" })
    : "";
  const line2 = `${ctxLabel} ${bar} ${pct}%${tokenPart}${tokLine ? ` │ ${tokLine}` : ""}${meta.length ? ` │ ${meta.join(" │ ")}` : ""}`;

  const lines = [line1, line2];
  if (
    session.sessionTokens &&
    session.lastTurnTokens &&
    (session.sessionTokens.inputTokens !== session.lastTurnTokens.inputTokens ||
      session.sessionTokens.outputTokens !==
        session.lastTurnTokens.outputTokens)
  ) {
    lines.push(
      formatTokenBreakdownLine(session.sessionTokens, {
        mode: "exact",
        prefix: "ΣTOK",
      }),
    );
  }

  const usageLine = formatUsageLine(usage, options, L.use);
  if (usageLine) lines.push(usageLine);

  const toolLine = formatToolLine(session.tools);
  if (toolLine) {
    lines.push(toolLine);
  }

  if (session.agents?.length) {
    const a = session.agents[session.agents.length - 1]!;
    lines.push(
      `◎ ${a.title ?? "agent"}${a.detail ? `: ${a.detail}` : ""}`,
    );
  }

  if (options.compact) {
    return lines.slice(0, 2).join(" · ");
  }

  return lines.join("\n");
}

function displayModel(model: string): string {
  if (!model || model === "unknown") return "Grok";
  // grok-4.5 -> Grok 4.5
  return model
    .replace(/^grok-/i, "Grok ")
    .replace(/-/g, " ");
}

function formatUsageLine(
  usage: UsageSnapshot | null | undefined,
  opts: RenderOptions,
  useLabel = "use",
): string {
  if (!usage) {
    return `${useLabel}   ${colorize("—", ANSI.dim, opts.color)} unavailable`;
  }
  if (!usage.available) {
    return `${useLabel}   ${colorize("—", ANSI.dim, opts.color)} ${usage.message ?? "unavailable"}`;
  }
  const pct = usage.percent ?? 0;
  const bar = colorize(renderBar(pct), severityColor(pct, opts), opts.color);
  const nums =
    usage.used != null && usage.limit != null
      ? ` · ${formatTokenCount(usage.used)}/${formatTokenCount(usage.limit)}`
      : "";
  const period = usage.period ? ` (${usage.period})` : "";
  const reset = usage.resetsIn ? ` · ${usage.resetsIn}` : "";
  const prod = usage.message ? ` · ${usage.message}` : "";
  return `${useLabel}   ${bar} ${Math.round(pct)}%${period}${nums}${reset}${prod}`;
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
