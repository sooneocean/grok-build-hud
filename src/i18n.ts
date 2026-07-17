/**
 * HUD + settings UI strings.
 * Default language: zh-Hans (简体中文). Switch via settings → English.
 */
import type { HudDisplayConfig } from "./hud-config.js";

export type HudLang = "zh-Hans" | "zh-Hant" | "en";

export interface HudStrings {
  /** Short labels for status strip (keep short — window width) */
  ctx: string;
  use: string;
  turn: string;
  tools: string;
  in: string;
  out: string;
  cache: string;
  reason: string;
  sum: string;
  live: string;
  stale: string;
  err: string;
  weekly: string;
  monthly: string;
  left: string;
  /** Settings UI */
  settingsTitle: string;
  settingsHint: string;
  lang: string;
  langZh: string;
  langZhHant: string;
  langEn: string;
  preset: string;
  statusLines: string;
  tokenBreakdown: string;
  on: string;
  off: string;
  themeFollow: string;
  themeFollowHint: string;
  saveExit: string;
  quitNoSave: string;
  saved: string;
  cancelled: string;
  current: string;
  choose: string;
  invalid: string;
  rows: string;
  presetFull: string;
  presetEssential: string;
  presetMinimal: string;
  back: string;
  languageSet: string;
  helpSettings: string;
}

const ZH_HANS: HudStrings = {
  ctx: "窗",
  use: "额",
  turn: "轮",
  tools: "具",
  in: "入",
  out: "出",
  cache: "缓",
  reason: "思",
  sum: "Σ",
  live: "在线",
  stale: "闲置",
  err: "错",
  weekly: "周",
  monthly: "月",
  left: "剩余",
  settingsTitle: "Grok HUD 设定",
  settingsHint: "输入数字选择 · Enter 确认 · 0 保存退出",
  lang: "语言",
  langZh: "简体中文",
  langZhHant: "繁體中文",
  langEn: "English",
  preset: "显示预设",
  statusLines: "状态行数",
  tokenBreakdown: "Token 明细 (入/出/缓)",
  on: "开",
  off: "关",
  themeFollow: "主题",
  themeFollowHint: "跟随 Grok /theme（不锁死）",
  saveExit: "保存并退出",
  quitNoSave: "不保存退出",
  saved: "已保存",
  cancelled: "已取消，未保存",
  current: "当前",
  choose: "请选择",
  invalid: "无效选项，请重试",
  rows: "行",
  presetFull: "完整 (3 行)",
  presetEssential: "精简 (2 行)",
  presetMinimal: "最小 (1 行)",
  back: "返回",
  languageSet: "语言已设为",
  helpSettings: "打开设定界面（语言 / 预设 / 行数）",
};

const ZH_HANT: HudStrings = {
  ...ZH_HANS,
  ctx: "窗",
  use: "額",
  turn: "輪",
  tools: "具",
  in: "入",
  out: "出",
  cache: "緩",
  reason: "思",
  live: "在線",
  stale: "閒置",
  err: "錯",
  weekly: "週",
  monthly: "月",
  left: "剩餘",
  settingsTitle: "Grok HUD 設定",
  settingsHint: "輸入數字選擇 · Enter 確認 · 0 儲存離開",
  lang: "語言",
  langZh: "簡體中文",
  langZhHant: "繁體中文",
  langEn: "English",
  preset: "顯示預設",
  statusLines: "狀態行數",
  tokenBreakdown: "Token 明細 (入/出/緩)",
  on: "開",
  off: "關",
  themeFollow: "主題",
  themeFollowHint: "跟隨 Grok /theme（不鎖死）",
  saveExit: "儲存並離開",
  quitNoSave: "不儲存離開",
  saved: "已儲存",
  cancelled: "已取消，未儲存",
  current: "目前",
  choose: "請選擇",
  invalid: "無效選項，請重試",
  rows: "行",
  presetFull: "完整 (3 行)",
  presetEssential: "精簡 (2 行)",
  presetMinimal: "最小 (1 行)",
  back: "返回",
  languageSet: "語言已設為",
  helpSettings: "開啟設定介面（語言 / 預設 / 行數）",
};

const EN: HudStrings = {
  ctx: "ctx",
  use: "use",
  turn: "t",
  tools: "⚙",
  in: "i",
  out: "o",
  cache: "c",
  reason: "r",
  sum: "Σ",
  live: "live",
  stale: "stale",
  err: "err",
  weekly: "weekly",
  monthly: "monthly",
  left: "left",
  settingsTitle: "Grok HUD Settings",
  settingsHint: "Enter a number · 0 save & exit",
  lang: "Language",
  langZh: "简体中文",
  langZhHant: "繁體中文",
  langEn: "English",
  preset: "Display preset",
  statusLines: "Status rows",
  tokenBreakdown: "Token breakdown (in/out/cache)",
  on: "on",
  off: "off",
  themeFollow: "Theme",
  themeFollowHint: "Follows Grok /theme (not locked)",
  saveExit: "Save & exit",
  quitNoSave: "Quit without saving",
  saved: "Saved",
  cancelled: "Cancelled — not saved",
  current: "current",
  choose: "Choose",
  invalid: "Invalid option, try again",
  rows: "rows",
  presetFull: "Full (3 rows)",
  presetEssential: "Essential (2 rows)",
  presetMinimal: "Minimal (1 row)",
  back: "Back",
  languageSet: "Language set to",
  helpSettings: "Open settings UI (language / preset / rows)",
};

export function normalizeLang(raw?: string | null): HudLang {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "zh-Hans";
  if (s === "en" || s === "english" || s === "eng") return "en";
  if (
    s === "zh-hant" ||
    s === "zh_tw" ||
    s === "zh-tw" ||
    s === "tw" ||
    s === "hant" ||
    s === "繁體" ||
    s === "繁体"
  ) {
    return "zh-Hant";
  }
  if (
    s === "zh" ||
    s === "zh-hans" ||
    s === "zh_cn" ||
    s === "zh-cn" ||
    s === "cn" ||
    s === "hans" ||
    s === "中文" ||
    s === "简体" ||
    s === "簡體"
  ) {
    return "zh-Hans";
  }
  return "zh-Hans";
}

export function t(lang?: string | null): HudStrings {
  const l = normalizeLang(lang);
  if (l === "en") return EN;
  if (l === "zh-Hant") return ZH_HANT;
  return ZH_HANS;
}

export function stringsFromConfig(cfg: Pick<HudDisplayConfig, "language">): HudStrings {
  return t(cfg.language);
}

export function langLabel(lang: HudLang, uiLang?: HudLang): string {
  const s = t(uiLang ?? lang);
  if (lang === "en") return s.langEn;
  if (lang === "zh-Hant") return s.langZhHant;
  return s.langZh;
}
