# Grok HUD × Codex App 设计美学导入计划

> 目标版本：**0.4.2 → 0.6.0**  
> 原则：学 **Codex App / CodexBar 的冷静信息美学**，不抄菜单栏形态；  
> 宿主仍是 Grok + tmux 同窗条。  
> 写于：2026-07-29

---

## 0. 一句话

Codex App 像 **「安静的仪表」**：少色、轻分隔、状态才上色、主信息一眼可扫。  
当前 Grok HUD 更像 **「满配工程面板」**：信息全、token 墙、分隔重、accent 偏紫。  
导入美学 = **降噪 + 层级 + 语义色 + 密度可调**，不是删功能。

---

## 1. Codex 美学原则（可执行）

| # | 原则 | 类比 | 对 Grok HUD 的含义 |
|---|------|------|-------------------|
| C1 | **冷静底色** | 深灰锌色，不是霓虹 | 默认 dark 用 zinc/slate，accent 单一 |
| C2 | **状态才着色** | 绿/琥珀/红只表达健康 | 窗/额 % 用 ok→warn→crit；路径/标题不染色 |
| C3 | **一个品牌色** | Codex 偏 teal/emerald 点缀 | live 点、model 徽章用单一 accent，忌彩虹 |
| C4 | **轻分隔** | 中点 `·` 优于粗 `│` | 默认 sep = middot；管道作次选 |
| C5 | **密度分层** | 菜单栏 chip vs 侧栏详情 | comfortable / compact / dense 三档 |
| C6 | **主视线两条** | 身份 + 健康（窗/额） | TOK / Σ / effort 默认退居次行或阈值门 |
| C7 | **进度克制** | 细轨或短 bar，不占半屏 | barWidth 默认 8–10；可选 thin/dot |
| C8 | **数字优先** | 42% 比长标签更先读 | 标签更短/dim；数值 bold |
| C9 | **活动行像字幕** | 一行滚动、完成折叠 | tools 聚合；agents 最多 2 |
| C10 | **呼吸感** | 窄窗先丢装饰再丢数字 | 优先级表：live 健康 > 身份 > 活动 > 明细 |

**不照搬：**

- 不做 macOS 菜单栏 App（CodexBar 赛道）
- 不绑 OpenAI 品牌色永久写死（可作 `aesthetic: codex` 预设）
- 不牺牲多终端隔离 / 主题跟随 Grok

---

## 2. 现状 vs 目标（视觉）

| 维度 | 现状 (0.4.1 full) | Codex 向目标 |
|------|-------------------|--------------|
| 分隔 | `│` 偏硬 | 默认 `·`，compact 更稀 |
| 进度条 | 宽 14 块状 █░ | 默认 8–10；thin `━`/`─`；或 percent-only |
| Token 墙 | 常驻 IN/OUT/CACHE exact | ≥阈值或 full+显式开才显示；默认 short |
| Accent | 紫（grokday/groknight） | codex 预设 teal；仍可跟随 Grok theme |
| 行数 | 3 行常满 | compact 2 行主路径；dense 1 行 chip |
| 标签 | 窗/额 已对齐 | 继续 dim + 对齐；英文更短 |
| 活动 | 工具详情偏长 | 截断更狠；完成只 ×N |

---

## 3. 完整优化 TODO（按优先级）

### Wave D0 — 美学配置面（0.4.2）✅ 本批落地

- [x] `aesthetic`: `classic` \| `codex` \| `dense`
- [x] `density`: `comfortable` \| `compact` \| `dense`（映射 barWidth / sep / token 门）
- [x] `separator`: `middot` \| `pipe` \| `space`
- [x] `barStyle`: `block` \| `thin` \| `dot`
- [x] `THEME_CODEX` 冷静 zinc + emerald
- [x] compose 吃 separator / barStyle / density
- [x] settings 可切 aesthetic + 预览
- [x] 测试 + CHANGELOG + 双推

### Wave D1 — 信息层级与降噪（0.4.3）✅

- [x] Token 明细 short + `tokenRevealAtContextPercent`（codex 70）
- [x] 第 2 行「主健康」：codex/dense **只保 窗+额**；meta/TOK 不进主视线
- [x] effort / title 默认 essential/codex 关；codex 下 effort 无 `effort:` 前缀
- [x] GrokBuild 挂在 usage 行尾（不另占 meta 芯片）
- [x] essential 预设对齐 compact middot + short tokens

### Wave D2 — 语义色与动效克制（0.4.4）✅

- [x] 统一 severity：`<warn` green / `warn–crit` amber / `≥crit` red（窗与额同一套）
- [x] live 点：静· accent；stale 更灰；禁止闪烁
- [x] THEME_CODEX_LIGHT（浅色 codex）纸色底 + 深墨数字
- [x] `colors.*` 用户覆盖（hex）合并进 palette

### Wave D3 — 窄窗与芯片布局（0.5.0）✅

- [x] dense 模式 1 行 chip：`[G4.5] · 窗42% · 额24% · ◐read`
- [x] CJK width 全面接管 trim（layout.ts 用 width.ts 视觉宽）
- [x] 窗口 resize 不抖：hysteresis ≥2 cols
- [x] 多 session 时 dim 非当前（`--all` plain 列表）

### Wave D4 — CodexBar 级配额体验（0.6.0）✅

- [x] 配额 chip：`额 24% · 3h` 紧凑格式（无 “weekly” 长词时可缩 `周`）
- [x] 阈值门：额 ≥80% 才加粗/变色强调（冷静：平时不叫）
- [x] usage sidecar 写盘（供其它工具 / 对齐 Claude externalUsage）
- [x] 可选「重置墙钟」`resets at 14:30`（timeFormat）

### Wave D5 — 抛光与文档（0.6.0）✅

- [x] README 美学对比表（classic vs codex vs dense）
- [x] `/hud` + `grok-hud info` 打印当前 aesthetic + 数据优先级
- [x] golden fixtures：3 aesthetic × zh/en × 宽 40/80/120 smoke
- [x] 性能：dashboard 变更检测少写盘（content-fp）

---

## 4. 配置草案（落地字段）

```jsonc
{
  "aesthetic": "codex",          // classic | codex | dense
  "density": "compact",          // comfortable | compact | dense
  "separator": "middot",         // middot | pipe | space
  "barStyle": "thin",            // block | thin | dot
  "barWidth": 10,
  "alignLabels": true,
  "display": {
    "tokenDigits": "short",
    "tokenRevealAtContextPercent": 70,
    "contextValue": "percent",   // codex 默认更干净；both 可开
    "usageValue": "percent",
    "showTitle": false,          // codex compact 默认关标题
    "showTokenBreakdown": true
  }
}
```

**预设映射：**

| aesthetic | density | sep | bar | token | 备注 |
|-----------|---------|-----|-----|-------|------|
| classic | comfortable | pipe | block 14 | exact | 兼容 0.4.1 观感 |
| codex | compact | middot | thin 10 | short + 70% 门 | **推荐默认新用户** |
| dense | dense | space | dot 6 | 隐藏至 85% | 窄屏 / 极简 |

> 兼容：已有用户无 `aesthetic` 字段 → 视为 `classic`，不破坏现网。

---

## 5. 视觉规范（token）

### Codex palette（dark）

| 角色 | Hex | 用途 |
|------|-----|------|
| bg | `default` / `#12141a` | 条背景（可选） |
| label | `#6b7280` | 窗/额 标签 |
| value | `#e5e7eb` | 主数字 |
| sep | `#3f3f46` | 分隔 |
| accent | `#34d399` | model / live（emerald） |
| ok | `#4ade80` | 健康 % |
| warn | `#fbbf24` | 警告 |
| crit | `#f87171` | 危险 |
| barEmpty | `#27272a` | 空轨 |

### 字重（tmux 能力内）

- 标签：italic + dim（浅色主题不 dim）
- 主数字 / model：bold
- 次要 path：italic
- 活动完成：default；运行中：accent

### 进度条字符

| barStyle | filled | empty |
|----------|--------|-------|
| block | `█` | `░` |
| thin | `━` | `─` |
| dot | `●` | `○`（宽更省） |

---

## 6. 验收标准（美学）

1. **3 秒扫视**：不看第三行也能答「上下文紧不紧、额度紧不紧」。  
2. **默认 codex 预设**：第 2 行无 exact 百万 token 墙（除非 ctx≥门限）。  
3. **色数**：同一行可见高饱和色 ≤2（accent + 一个 severity）。  
4. **窄 60 列**：不换行碎裂；自动 dense 丢 title/TOK。  
5. **切换 aesthetic**：settings 预览立刻变；保存后 ≤2s 底栏更新。  
6. **回归**：classic 与 0.4.1 观感接近（允许 middot 差异文档说明）。

---

## 7. 与已有路线的关系

| 已完成 | 本美学线 |
|--------|----------|
| 0.3.15 数据回退 | 不改数据层 |
| 0.4.0 compose 单管线 | **美学只改 compose + theme + config** |
| 0.4.1 elementOrder | density 映射默认 order |
| 原 Phase C 功能（git stats 等） | 仍 opt-in；默认不进主视线 |

---

## 8. 本批（D0 / 0.4.2）实施清单

1. `hud-config`：aesthetic / density / separator / barStyle + applyAesthetic()  
2. `theme`：THEME_CODEX + aesthetic 参与 resolve（可选锁定 codex 色）  
3. `bar.ts` / compose：barStyle + separator  
4. density 映射 barWidth / tokenDigits / showTitle 默认  
5. settings：切 aesthetic + 预览  
6. 测试 + 双推  

---

## 9. 拍板建议

- **新默认：** 文档推荐 `codex`；**已安装用户保持 classic**（无破坏）。  
- 用户可：`grok-hud settings` 或 config `"aesthetic": "codex"`。  
- 下一刀 D1：token 揭示门限 + 主视线降噪。
