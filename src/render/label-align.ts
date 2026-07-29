/**
 * Align progress-bar labels (窗/额 or ctx/use) to the same visual width.
 */
import type { HudStrings } from "../i18n.js";
import { padEndVisible, visualLen } from "./width.js";

/** Max visual width among progress labels used on the metrics row. */
export function progressLabelWidth(L: Pick<HudStrings, "ctx" | "use">): number {
  return Math.max(visualLen(L.ctx), visualLen(L.use));
}

/** Right-pad a label so bars start in the same column. */
export function alignedLabel(
  label: string,
  L: Pick<HudStrings, "ctx" | "use">,
  enabled: boolean,
): string {
  if (!enabled) return label;
  const w = progressLabelWidth(L);
  return padEndVisible(label, w);
}
