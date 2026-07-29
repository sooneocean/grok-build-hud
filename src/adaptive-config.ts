/**
 * Width-adaptive config: optionally collapse to dense chip when narrow.
 */
import {
  applyAesthetic,
  type HudDisplayConfig,
} from "./hud-config.js";

/**
 * When `autoDenseBelow` > 0 and cols < threshold, render as dense for this
 * paint only (does not rewrite config.json).
 *
 * threshold 0 = disabled.
 */
export function resolveAdaptiveConfig(
  cfg: HudDisplayConfig,
  cols: number,
): HudDisplayConfig {
  const threshold =
    typeof cfg.autoDenseBelow === "number" ? cfg.autoDenseBelow : 0;
  if (!threshold || threshold <= 0) return cfg;
  if (!Number.isFinite(cols) || cols <= 0) return cfg;
  if (cols >= threshold) return cfg;
  if (cfg.aesthetic === "dense" || cfg.density === "dense") return cfg;
  // Soft dense for narrow pane — keep language + optional chip flags
  return applyAesthetic("dense", cfg);
}

/** Default threshold for calm aesthetics when user never set the field. */
export function defaultAutoDenseBelow(
  aesthetic: string | undefined,
): number {
  if (aesthetic === "codex" || aesthetic === "dense") return 60;
  return 0;
}
