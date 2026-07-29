/**
 * Single plain-text HUD composer.
 * Phase B: elementOrder + mergeGroups + label-align + remaining modes.
 */
import {
  formatDuration,
  formatTokenCount,
  projectLabel,
  renderBar,
} from "../bar.js";
import { formatToolLine } from "../activity.js";
import {
  barChars,
  DEFAULT_ELEMENT_ORDER,
  DEFAULT_MERGE_GROUPS,
  DEFAULT_PROJECT_LINE_ORDER,
  loadHudConfig,
  separatorString,
  type FirstLineSegment,
  type HudDisplayConfig,
  type HudElement,
} from "../hud-config.js";
import { stringsFromConfig, type HudStrings } from "../i18n.js";
import { formatTokenBreakdownLine } from "../token-usage.js";
import type {
  SessionSnapshot,
  TodoItem,
  TokenBreakdown,
  UsageSnapshot,
} from "../types.js";
import { formatResetFragment } from "../format-reset-time.js";
import { alignedLabel } from "./label-align.js";
import { truncateVisible } from "./width.js";

export function displayModel(model: string): string {
  if (!model || model === "unknown") return "Grok";
  return model.replace(/^grok-/i, "Grok ").replace(/-/g, " ");
}

/** Dense chip: grok-4.5 → G4.5 */
export function displayModelShort(model: string): string {
  if (!model || model === "unknown") return "G";
  const full = displayModel(model);
  return full.replace(/^Grok\s+/i, "G").replace(/\s+/g, "");
}

export function contextValueText(
  session: SessionSnapshot,
  mode: HudDisplayConfig["display"]["contextValue"],
): string {
  const pct = Math.round(session.contextPercent);
  const remaining = Math.max(0, 100 - pct);
  const tokens =
    session.contextWindowTokens > 0
      ? `${formatTokenCount(session.contextTokensUsed)}/${formatTokenCount(session.contextWindowTokens)}`
      : "";
  const remainTok =
    session.contextWindowTokens > 0
      ? formatTokenCount(
          Math.max(0, session.contextWindowTokens - session.contextTokensUsed),
        )
      : "";
  if (mode === "tokens") return tokens || `${pct}%`;
  if (mode === "remaining") {
    if (remainTok) return `${remaining}% (${remainTok} left)`;
    return `${remaining}% left`;
  }
  if (mode === "both") return tokens ? `${pct}% (${tokens})` : `${pct}%`;
  return `${pct}%`;
}

function usageValueText(
  usage: UsageSnapshot,
  mode: HudDisplayConfig["display"]["usageValue"],
): string {
  const used = usage.percent ?? 0;
  if (mode === "remaining") {
    const rem = Math.max(0, Math.round(100 - used));
    return `${rem}%`;
  }
  return `${Math.round(used)}%`;
}

function formatTodosLine(todos: TodoItem[]): string {
  if (!todos.length) return "";
  const done = todos.filter((t) => t.status === "completed").length;
  const cur =
    todos.find((t) => t.status === "in_progress") ??
    todos.find((t) => t.status === "pending");
  const label = cur?.content
    ? truncateVisible(cur.content, 42)
    : "todos";
  return `▸ ${label} (${done}/${todos.length})`;
}

/** Agents: show up to 2 recent subagents with type/detail/status. */
function formatAgentsLine(session: SessionSnapshot): string {
  if (!session.agents?.length) return "";
  const recent = session.agents.slice(-2);
  const parts = recent.map((a) => {
    const title = a.title ?? "agent";
    const typeBit =
      a.detail && a.detail !== title
        ? `[${truncateVisible(a.detail, 16)}]`
        : "";
    const status =
      a.status && a.status !== "active" ? ` ${a.status}` : "";
    const icon =
      a.status === "completed" || a.status === "success"
        ? "✓"
        : a.status === "cancelled" || a.status === "failed"
          ? "✗"
          : "◐";
    return `${icon} ${title}${typeBit ? ` ${typeBit}` : ""}${status}`;
  });
  return parts.join(" | ");
}

function pickTokenForDisplay(
  session: SessionSnapshot,
  scope: HudDisplayConfig["display"]["tokenScope"],
): { last: TokenBreakdown | null; sessionSum: TokenBreakdown | null } {
  const last = session.lastTurnTokens ?? null;
  const sessionSum = session.sessionTokens ?? null;
  if (scope === "session") return { last: null, sessionSum };
  if (scope === "last") return { last, sessionSum: null };
  return { last, sessionSum };
}

function tokenLinesForHud(
  session: SessionSnapshot,
  cfg: HudDisplayConfig,
): string[] {
  if (!cfg.display.showTokenBreakdown) return [];
  // Codex calm: hide token wall until context is hot
  const gate = cfg.tokenRevealAtContextPercent ?? 0;
  if (gate > 0 && session.contextPercent < gate) return [];
  const mode = cfg.display.tokenDigits ?? "exact";
  const { last, sessionSum } = pickTokenForDisplay(
    session,
    cfg.display.tokenScope ?? "both",
  );
  const short = mode === "short" ? formatTokenCount : undefined;
  const out: string[] = [];
  if (last) {
    out.push(
      formatTokenBreakdownLine(last, {
        mode,
        prefix: "TOK",
        formatShort: short,
      }),
    );
  }
  if (
    sessionSum &&
    (cfg.display.tokenScope === "both" || cfg.display.tokenScope === "session")
  ) {
    const same =
      last &&
      last.inputTokens === sessionSum.inputTokens &&
      last.outputTokens === sessionSum.outputTokens &&
      last.cachedReadTokens === sessionSum.cachedReadTokens;
    if (!same) {
      out.push(
        formatTokenBreakdownLine(sessionSum, {
          mode,
          prefix: "ΣTOK",
          formatShort: short,
        }),
      );
    }
  }
  return out;
}

function resolveOrder(cfg: HudDisplayConfig): HudElement[] {
  return cfg.elementOrder?.length
    ? cfg.elementOrder
    : [...DEFAULT_ELEMENT_ORDER];
}

function resolveMergeGroups(cfg: HudDisplayConfig): HudElement[][] {
  // Empty array is intentional (no merging). Only fall back when unset.
  if (cfg.mergeGroups !== undefined) return cfg.mergeGroups;
  return DEFAULT_MERGE_GROUPS.map((g) => [...g]);
}

function resolveProjectOrder(cfg: HudDisplayConfig): FirstLineSegment[] {
  // Explicit order wins fully (even if shorter than defaults).
  if (cfg.projectLineOrder !== undefined && cfg.projectLineOrder.length > 0) {
    return cfg.projectLineOrder;
  }
  return [...DEFAULT_PROJECT_LINE_ORDER];
}

function groupIdOf(
  el: HudElement,
  groups: HudElement[][],
): number {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.includes(el)) return i;
  }
  return -1;
}

function buildProjectLine(
  session: SessionSnapshot,
  cfg: HudDisplayConfig,
  L: HudStrings,
): string {
  const d = cfg.display;
  const order = resolveProjectOrder(cfg);
  const parts: string[] = [];

  const emit = (seg: FirstLineSegment): string | null => {
    switch (seg) {
      case "model":
        return d.showModel ? `[${displayModel(session.model)}]` : null;
      case "project": {
        if (!d.showProject) return null;
        let proj = projectLabel(session.cwd, cfg.pathLevels);
        if (d.showGit && session.branch) {
          const dirty = d.showGitDirty && session.gitDirty ? "*" : "";
          let ab = "";
          if (session.gitAhead) ab += `↑${session.gitAhead}`;
          if (session.gitBehind) ab += `↓${session.gitBehind}`;
          proj += ` git:(${session.branch}${dirty}${ab})`;
        }
        return proj;
      }
      case "live":
        if (!d.showLive) return null;
        return session.live ? `● ${L.live}` : `○ ${L.stale}`;
      case "title":
        return d.showTitle && session.title
          ? truncateVisible(session.title, 36)
          : null;
      case "effort":
        // D1: short chrome — no "effort:" noise under codex/dense
        if (!session.reasoningEffort) return null;
        if ((cfg.aesthetic ?? "classic") !== "classic") {
          return session.reasoningEffort;
        }
        return `effort:${session.reasoningEffort}`;
      default:
        return null;
    }
  };

  for (const seg of order) {
    const t = emit(seg);
    if (t) parts.push(t);
  }
  const sep = separatorString(cfg.separator);
  return parts.join(sep);
}

/** Context fragment with optional label pad (space after label preserved). */
function progressBar(percent: number, cfg: HudDisplayConfig): string {
  const { filled, empty } = barChars(cfg.barStyle);
  const w =
    cfg.barWidth && cfg.barWidth > 0
      ? cfg.barWidth
      : cfg.density === "dense"
        ? 6
        : cfg.density === "compact"
          ? 10
          : 12;
  return renderBar(percent, w, filled, empty);
}

function fragContext(
  session: SessionSnapshot,
  cfg: HudDisplayConfig,
  L: HudStrings,
): string {
  const d = cfg.display;
  const align = cfg.alignLabels !== false;
  const label = alignedLabel(L.ctx, L, align);
  const cBar = d.showContextBar
    ? progressBar(session.contextPercent, cfg) + " "
    : "";
  return `${label} ${cBar}${contextValueText(session, d.contextValue)}`;
}

function fragUsage(
  usage: UsageSnapshot | null | undefined,
  cfg: HudDisplayConfig,
  L: HudStrings,
): string {
  const d = cfg.display;
  if (!d.showUsage || !usage) return "";
  const align = cfg.alignLabels !== false;
  const label = alignedLabel(L.use, L, align);
  if (usage.available && usage.percent != null) {
    const displayPct =
      d.usageValue === "remaining"
        ? Math.max(0, 100 - usage.percent)
        : usage.percent;
    const uBar = d.showContextBar ? progressBar(displayPct, cfg) + " " : "";
    // Classic: show used/limit; codex/dense: percent + reset only (calm)
    const showAbs =
      (cfg.aesthetic ?? "classic") === "classic" && cfg.density !== "dense";
    const abs =
      showAbs && usage.used != null && usage.limit != null
        ? ` ${formatTokenCount(usage.used)}/${formatTokenCount(usage.limit)}`
        : "";
    const mid = separatorString(cfg.separator).trim() || "·";
    const resetFrag = formatResetFragment(
      usage,
      cfg.timeFormat ?? "relative",
    );
    const reset = resetFrag
      ? ` ${mid} ${resetFrag}${
          (cfg.aesthetic ?? "classic") === "codex" ||
          (cfg.aesthetic ?? "classic") === "dense"
            ? ""
            : cfg.timeFormat === "absolute"
              ? ""
              : ` ${L.left}`
        }`
      : "";
    const val = usageValueText(usage, d.usageValue ?? "percent");
    const valBit =
      d.usageValue === "remaining" ? `${val} ${L.left}` : val;
    // D4: classic comfortable keeps (weekly); codex/dense omit period when reset shown
    const aesthetic = cfg.aesthetic ?? "classic";
    const period =
      usage.period && aesthetic === "classic" && cfg.density === "comfortable"
        ? ` (${usage.period})`
        : usage.period && aesthetic === "classic"
          ? ` ${usage.period === "weekly" ? L.weekly || "w" : usage.period === "monthly" ? L.monthly || "m" : usage.period}`
          : usage.period && !resetFrag
            ? ` ${usage.period === "weekly" ? L.weekly || "w" : usage.period === "monthly" ? L.monthly || "m" : usage.period}`
            : "";
    let line = `${label} ${uBar}${valBit}${period}${abs}${reset}`;
    // D1: product share rides on usage (tail)
    if (d.showProductBreakdown && usage.message) {
      const gb = productShare(usage.message);
      if (gb) line += ` ${mid} ${gb}`;
    }
    return line;
  }
  return `${label} — ${usage.message ?? "n/a"}`;
}

function productShare(message: string): string | null {
  const gb = message
    .split(",")
    .map((s) => s.trim())
    .find((s) => /GrokBuild/i.test(s));
  return gb ?? null;
}

/**
 * Main health line priority (D1): context > usage > meta > tokens.
 * codex/dense keep only context+usage on the eye line.
 */
function isMainSightOnly(cfg: HudDisplayConfig): boolean {
  const a = cfg.aesthetic ?? "classic";
  return a === "codex" || a === "dense" || cfg.density === "dense";
}

function fragMeta(
  session: SessionSnapshot,
  usage: UsageSnapshot | null | undefined,
  cfg: HudDisplayConfig,
  L: HudStrings,
): string {
  // Under main-sight aesthetics, meta is suppressed on the health line
  // (product already on usage; time/turns are secondary noise).
  if (isMainSightOnly(cfg)) return "";

  const d = cfg.display;
  const meta: string[] = [];
  if (d.showSessionTime && session.durationSeconds > 0) {
    meta.push(formatDuration(session.durationSeconds));
  }
  if (d.showTurns && session.turnCount > 0) {
    meta.push(`${L.turn}${session.turnCount}`);
  }
  if (d.showTools && session.toolCallCount > 0) {
    meta.push(`${L.tools}${session.toolCallCount}`);
  }
  if (d.showErrors && (session.errorCount > 0 || session.toolFailureCount > 0)) {
    meta.push(`${L.err} ${session.errorCount || session.toolFailureCount}`);
  }
  if (
    d.showDiffStats &&
    (session.agentLinesAdded > 0 || session.agentLinesRemoved > 0)
  ) {
    meta.push(`Δ +${session.agentLinesAdded}/-${session.agentLinesRemoved}`);
  }
  // product lives on usage line now — avoid duplicate
  return meta.join(separatorString(cfg.separator));
}

function fragTokens(session: SessionSnapshot, cfg: HudDisplayConfig): string {
  const parts = tokenLinesForHud(session, cfg);
  return parts[0] ?? "";
}

function fragTokensExtra(
  session: SessionSnapshot,
  cfg: HudDisplayConfig,
): string {
  const parts = tokenLinesForHud(session, cfg);
  return parts[1] ?? "";
}

/**
 * Build per-element plain fragments (empty string = skip).
 * `project` is special: becomes its own identity line when present.
 */
function elementFragment(
  el: HudElement,
  session: SessionSnapshot,
  usage: UsageSnapshot | null | undefined,
  cfg: HudDisplayConfig,
  L: HudStrings,
): string {
  const d = cfg.display;
  switch (el) {
    case "project":
      return buildProjectLine(session, cfg, L);
    case "context":
      return fragContext(session, cfg, L);
    case "usage":
      return fragUsage(usage, cfg, L);
    case "tokens":
      return fragTokens(session, cfg);
    case "meta":
      return fragMeta(session, usage, cfg, L);
    case "tools":
      return d.showToolActivity ? formatToolLine(session.tools) : "";
    case "agents":
      return d.showAgents ? formatAgentsLine(session) : "";
    case "todos":
      return d.showTodos ? formatTodosLine(session.todos) : "";
    default:
      return "";
  }
}

/**
 * Dense one-line chip (Codex-bar-ish):
 *   [G4.5] · path · ● · 窗42% · 额24% · ◐read_file
 */
export function composeDenseChip(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  const L = stringsFromConfig(cfg);
  const sep = separatorString(cfg.separator ?? "space").trim() || " ";
  const join = sep.length === 1 ? ` ${sep} ` : sep;
  const bits: string[] = [];

  if (cfg.display.showModel !== false) {
    bits.push(`[${displayModelShort(session.model)}]`);
  }
  if (cfg.display.showProject !== false) {
    let proj = projectLabel(session.cwd, cfg.pathLevels ?? 1);
    // dense: keep last segment only when long
    if (proj.length > 18) {
      const tail = proj.split("/").pop() || proj;
      proj = tail.length > 16 ? truncateVisible(tail, 14) : tail;
    }
    if (cfg.display.showGit && session.branch) {
      const dirty = cfg.display.showGitDirty && session.gitDirty ? "*" : "";
      proj += `:${session.branch}${dirty}`;
    }
    bits.push(proj);
  }
  if (cfg.display.showLive !== false) {
    bits.push(session.live ? "●" : "○");
  }
  bits.push(`${L.ctx}${Math.round(session.contextPercent)}%`);
  if (cfg.display.showUsage !== false && usage?.available && usage.percent != null) {
    const u =
      cfg.display.usageValue === "remaining"
        ? Math.max(0, Math.round(100 - usage.percent))
        : Math.round(usage.percent);
    bits.push(`${L.use}${u}%`);
  }
  if (cfg.display.showToolActivity !== false && session.tools?.length) {
    const run = session.tools.find((t) => t.status === "running");
    if (run) {
      bits.push(`◐${run.name}`);
    } else {
      const done = session.tools.find((t) => t.status === "completed");
      if (done) bits.push(`✓${done.name}`);
    }
  }
  return bits.join(join);
}

function wantsDenseChip(cfg: HudDisplayConfig): boolean {
  return (
    cfg.aesthetic === "dense" ||
    cfg.density === "dense" ||
    (cfg.lineLayout === "compact" && cfg.statusLines === 1 && cfg.barStyle === "dot")
  );
}

/**
 * Compose semantic HUD lines (no ANSI, no tmux codes).
 * Uses elementOrder + mergeGroups (Claude-HUD-style).
 * Dense aesthetic → single chip line.
 */
export function composeHudLines(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string[] {
  if (wantsDenseChip(cfg)) {
    return [composeDenseChip(session, usage, cfg)];
  }

  const L = stringsFromConfig(cfg);
  const order = resolveOrder(cfg);
  const groups = resolveMergeGroups(cfg);
  const lines: string[] = [];

  let i = 0;
  while (i < order.length) {
    const el = order[i]!;
    const frag = elementFragment(el, session, usage, cfg, L);
    if (!frag) {
      i += 1;
      continue;
    }

    // project is always its own line (identity)
    if (el === "project") {
      lines.push(frag);
      i += 1;
      continue;
    }

    const gid = groupIdOf(el, groups);
    if (gid < 0) {
      // activity elements that share tools/agents/todos: merge consecutive
      // activity-like into one line when adjacent
      if (el === "tools" || el === "agents" || el === "todos") {
        const bits: string[] = [frag];
        let j = i + 1;
        while (j < order.length) {
          const next = order[j]!;
          if (next !== "tools" && next !== "agents" && next !== "todos") break;
          const nf = elementFragment(next, session, usage, cfg, L);
          if (nf) bits.push(nf);
          j += 1;
        }
        lines.push(bits.join(separatorString(cfg.separator)));
        i = j;
        continue;
      }
      lines.push(frag);
      i += 1;
      continue;
    }

    // Merge consecutive elements that share the same merge group
    const items: { el: HudElement; text: string }[] = [{ el, text: frag }];
    let j = i + 1;
    while (j < order.length) {
      const next = order[j]!;
      if (groupIdOf(next, groups) !== gid) break;
      const nf = elementFragment(next, session, usage, cfg, L);
      if (nf) items.push({ el: next, text: nf });
      j += 1;
    }
    // D1 main sight: health group keeps context + usage only
    const healthEls = new Set(["context", "usage", "tokens", "meta"]);
    const isHealthGroup = items.some((x) => healthEls.has(x.el));
    let texts = items.map((x) => x.text);
    if (isHealthGroup && isMainSightOnly(cfg)) {
      texts = items
        .filter((x) => x.el === "context" || x.el === "usage")
        .map((x) => x.text);
    } else if (isHealthGroup && (cfg.aesthetic ?? "classic") === "classic") {
      // classic: prefer context+usage first; drop tokens before meta if both present
      // (tokens already gated by tokenRevealAtContextPercent)
      texts = items.map((x) => x.text);
    }
    if (texts.length) {
      lines.push(texts.join(separatorString(cfg.separator)));
    }
    i = j;
  }

  // ΣTOK extra row when present
  const extra = fragTokensExtra(session, cfg);
  if (extra) {
    const insertAt = lines.length > 0 && order.includes("project") ? 2 : 1;
    if (insertAt <= lines.length) {
      lines.splice(insertAt, 0, extra);
    } else {
      lines.push(extra);
    }
  }

  if (cfg.lineLayout === "compact") {
    return [lines.slice(0, 2).join(separatorString(cfg.separator))].filter(
      Boolean,
    );
  }
  return lines.filter(Boolean);
}

/** Join compose lines into a single multi-line string. */
export function composeHudText(
  session: SessionSnapshot,
  usage?: UsageSnapshot | null,
  cfg: HudDisplayConfig = loadHudConfig(),
): string {
  return composeHudLines(session, usage, cfg).join("\n");
}

/** Preview helper for settings UI. */
export function previewHud(
  session: SessionSnapshot,
  usage: UsageSnapshot | null | undefined,
  cfg: HudDisplayConfig,
): string {
  return composeHudText(session, usage, cfg);
}
