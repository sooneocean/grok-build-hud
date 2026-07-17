import type { HudConfig } from "./types.js";

export const DEFAULT_CONFIG: HudConfig = {
  pathLevels: 2,
  refreshMs: 1000,
  warningThreshold: 70,
  criticalThreshold: 90,
  showUsage: true,
  usageCacheTtlMs: 60_000,
};

export function loadConfig(): HudConfig {
  return { ...DEFAULT_CONFIG };
}
