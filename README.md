# grok-build-hud

**面向 Grok Build 的第三方实时状态条**（社区自研，非 xAI 官方）

> English: [README.en.md](./README.en.md)

在**同一个 Terminal 标签页底部**常驻显示（tmux 状态栏，**不另开窗口**）：

```text
Grok 4.5 · AI FILM SPACE/0717 · ●
窗 ██████░░░░ 50% (252k/500k) · 入 2,189,879  出 9,468  缓 2,172,032 99% · 额 24% · 轮7 · 具212
◐ read_file… · ✓ grep ×3 · ▸ 待办
```

| 能力 | 说明 |
|------|------|
| 上下文 | 窗口占用 % 与 token 数 |
| 配额 | 周/月用量（需已 `grok login`） |
| Token 明细 | 入 / 出 / 缓存 / 推理（来自会话 `turn_completed`） |
| 活动 | 工具、agent、todos |
| 主题 | 跟随 Grok `[ui].theme`，不锁死 |
| 多终端 | 每个标签页**独立** session，互不串线 |
| 语言 | 默认 **English**，可切简体中文 / 繁體 |

仓库：http://172.238.15.154:3000/Redredchen01/grok-build-hud  
插件名：`grok-build-hud` · **1.0.0**（版本见 [`plugin.json`](./plugin.json)）

> **说明：** 本项目由我们自行开发与维护，**不是** xAI / Grok Build 官方插件或官方功能。仅兼容 Grok 的插件安装机制（`plugin.json` 等），便于本地 `grok plugin install`。

---

## 这是什么

| 层级 | 说明 |
|------|------|
| **身份** | **第三方 / 社区自研**工具，与 xAI 无官方从属 |
| **交付形态** | 按 Grok **插件机制**打包（`plugin.json` + `commands/` + `skills/` + `hooks/`） |
| **运行时** | Node CLI（`grok-hud` / `grok-build-hud`）+ **同窗口 tmux 状态条** |
| **Skill** | 插件内附带，方便会话里被 agent 识别与调用 |

**一句话：** 给我们自己用的 Grok Build 底部状态栏——上下文、配额、token、工具与待办，一眼看到；顺带可装成 Grok 插件。

---

## 目录

1. [依赖](#依赖)
2. [安装（推荐一键）](#安装推荐一键)
3. [安装拆解](#安装拆解)
4. [日常使用](#日常使用)
5. [会话内斜杠命令](#会话内斜杠命令)
6. [设定（语言 / 预设）](#设定语言--预设)
7. [状态条说明](#状态条说明)
8. [配置](#配置)
9. [主题](#主题)
10. [插件结构](#插件结构)
11. [工作原理](#工作原理)
12. [卸载](#卸载)
13. [常见问题](#常见问题)
14. [开发](#开发)

---

## 依赖

| 依赖 | 说明 |
|------|------|
| **Grok Build** | 已安装 CLI，并 `grok login` |
| **Node.js 18+** | `node -v` |
| **npm** | 随 Node 安装 |
| **tmux** | 同窗口 HUD 必需；macOS：`brew install tmux` |
| 终端 | Terminal / iTerm 等 |

---

## 安装（推荐一键）

从 Gitea 克隆后执行安装脚本：**编译 CLI → 装 tmux 状态条 → 注册为本地 Grok 插件（第三方）**。

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-build-hud.git
cd grok-build-hud
bash scripts/install.sh
```

脚本会依次：

1. `npm install` + `npm run build`
2. `npm link`（`grok-hud` / `grok-build-hud` 进 PATH）
3. `--install-dashboard`（hooks + tmux 多行状态条 + `grok` wrapper）
4. 主题跟随 + 预设 `full`
5. `grok plugin install . --trust` 并 `enable`（若本机有 `grok`）

完成后：

```bash
grok                 # 同窗口底部出现状态条
grok-hud status      # 打印一次完整状态
grok-hud settings    # 语言 / 预设 / 行数
```

在 Grok 内执行 `/hooks` 后按 `r` 重载 hooks（若提示未加载）。

### 命令找不到时

写入 `~/.zshrc`：

```bash
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

然后 `source ~/.zshrc`，再 `which grok-hud`。

---

## 安装拆解

只想分步做时：

### 1）仅 CLI + 同窗口状态条（无心功能）

```bash
cd /path/to/grok-build-hud
npm install && npm run build && npm link
npm run install-local
# 等价于：--install-dashboard + --theme auto + --preset full
```

### 2）注册为本地 Grok 插件（斜杠命令 + skill + session hooks）

> 这是把**本仓库**装进本机 Grok 的插件目录，不是从 xAI 官方 marketplace 安装。

须先完成编译（插件 hooks 依赖 `dist/`）：

```bash
cd /path/to/grok-build-hud
npm install && npm run build
grok plugin install . --trust
grok plugin enable grok-build-hud
```

校验：

```bash
grok plugin validate .
grok plugin details grok-build-hud
```

### 3）从本机已有源码目录更新

```bash
cd /path/to/grok-build-hud
git pull
bash scripts/install.sh
# 或：grok plugin update grok-build-hud
```

> **注意：** 只装插件、不跑 `install-dashboard` 时，会话里会有 `/hud` 等命令与 scrollback 注解，但**不会**出现底部多行 tmux 状态条。完整体验请用一键 `install.sh`。

---

## 日常使用

```bash
# 1. 打开 Terminal（会自动确保 HUD 后台更新器）
# 2. 输入：
grok
```

底部即出现状态条。

```bash
# 不要 HUD 的裸命令（脚本 / 打印模式）
GROK_NO_HUD=1 grok -p "hello"

# 兼容旧入口
grok-hud-run
```

**生命周期**：开 **Terminal** 即就绪；不是电脑开机自启。  
**并行开发**：每个标签页独立 Grok session，各自 `grok` 即可。

---

## 会话内斜杠命令

插件启用后，在 Grok 会话中可用：

| 命令 | 作用 |
|------|------|
| `/hud` | 状态条相关说明 + 数据优先级 |
| `/status` | 打印当前状态 |
| `/quota` | 配额相关 |
| `/preset` | 切换 full / essential / minimal |
| `/settings` | 语言、预设、美学、可选芯片 |
| `/setup` | 安装 / 修复 dashboard |
| `/watch` | 保持 HUD 实时更新说明 |

也可在 shell：

```bash
grok-hud status
grok-hud info                 # aesthetic + 可选芯片 + 数据优先级
grok-hud doctor               # 本机自检
grok-hud doctor --fix          # 安全自愈（hooks / daemon / 状态）
grok-hud set aesthetic=codex  # 非交互改配置
grok-hud settings             # 含 a/b/c/d 芯片 · e 窄窗自动 dense
grok-hud lang zh|en|tw
grok-build-hud --preset full|essential|minimal
grok-build-hud --theme auto
grok-hud stop
```

---

## 与 Claude HUD 对标（能力表）

| 能力 | Claude Code HUD（参考） | **Grok Build HUD（本项目）** |
|------|-------------------------|------------------------------|
| 宿主 | Claude Code 内置 statusLine | Grok 无 statusline → **tmux 同窗底栏** |
| 上下文 % | 有 | 有（signals / estimate） |
| 配额 / 重置 | 有 | 有 + `timeFormat` + usage sidecar |
| Token 入/出/缓 | 有 | 有（turn_completed） |
| 工具 / agent / todo | 有 | 有 |
| elementOrder / merge | 有 | 有（0.4.1+） |
| 美学密度 | 有 | classic / **codex** / dense |
| Git 文件统计 | 有（opt-in） | 有（0.7+，settings `a`） |
| Compaction 计数 | 有（opt-in） | 有（0.7+，settings `b`） |
| 输出 tok/s | 有（opt-in） | 有（0.7+，settings `c`） |
| 多终端隔离 | 视环境 | **每 Terminal 独立 session** |
| 官方身份 | 社区 Claude 插件 | **第三方，非 xAI 官方** |

> 只学信息架构与冷静美学，**不复制** Claude HUD 源码。

---

## 设定（语言 / 预设 / 芯片）

```bash
# 交互设定
grok-hud settings
# 菜单：1 语言 · 2 预设 · 9 美学 · a/b/c/d 可选芯片 · 8 预览 · 0 保存

# 快捷切语言
grok-hud lang en    # English（默认）
grok-hud lang zh    # 简体中文
grok-hud lang tw    # 繁體中文
```

改完配置后若条未变，在 tmux 内：

```bash
tmux source-file ~/.grok/hud/tmux.conf && tmux refresh-client -S
```

---

## 状态条说明

| 行 | 内容 |
|----|------|
| 第 1 行 | 模型 · 项目 · git · 在线 · 标题 · effort |
| 第 2 行 | **窗**进度条 + token · **额**配额 · 入/出/缓 · 轮次 · 工具 · 错误 |
| 第 3 行 | 最近工具 · agents · todos · GrokBuild 占比 |

中文标签：`窗 / 额 / 入 / 出 / 缓 / 思 / 轮 / 具`  
英文标签：`ctx / use / i / o / c / r / t / ⚙`  

宽度会随窗口自适应：窄窗自动减行、丢次要字段，避免挤出屏外。  
会话开启时约每秒刷新。

---

## 配置

文件：`~/.grok/hud/config.json`

| 预设 | 行数 | 内容 |
|------|------|------|
| **full**（默认） | 3 | 全部信息 |
| **essential** | 2 | 模型/git + 上下文/配额 + 活动 |
| **minimal** | 1 | 单行压缩 |

### 美学 aesthetic（0.4.2 → 0.6.0）

| aesthetic | density | 分隔 | 进度条 | 主视线 | 适用 |
|-----------|---------|------|--------|--------|------|
| **classic** | comfortable | `│` pipe | block 14 | 全字段 | 兼容旧版 |
| **codex**（推荐） | compact | `·` middot | thin 10 | **窗+额** 冷静 | 日常 |
| **dense** | dense | space | dot 6 | 1 行 chip | 窄屏 |

```bash
grok-hud settings          # 交互切 aesthetic
grok-hud info              # 打印 aesthetic + 数据优先级
```

```jsonc
{
  "aesthetic": "codex",
  "timeFormat": "relative",          // relative | absolute | both
  "usageEmphasisThreshold": 80,      // 额 ≥80% 才强调色
  "tokenRevealAtContextPercent": 70  // 窗够热才展开 token 墙
}
```

**配额数据优先级：** 实时 billing → 缓存 → `usage-sidecar.json` → 不可用。  
成功拉到配额时会写 `~/.grok/hud/usage-sidecar.json`（给其它工具读）。

### Phase C 可选字段（默认关）

在 `display` 里打开（开启不炸；默认 full 也不挤主视线）：

| 字段 | 效果 | 例 |
|------|------|----|
| `showGitFileStats` | 工作区文件变更计数 | `!2 +1 ✘1 ?3` |
| `showGitAheadBehind` | 相对远程 ↑↓ | `↑2↓1` |
| `showCompactions` | 本会话压缩次数（>0 才显） | `压2` |
| `showSpeed` | 输出速度 | `42 tok/s` |
| `showDiffStats` | agent 改行 Δ | `Δ +12/-3` |
| `autoDenseBelow` | 窄于 N 列时本帧切 dense 芯片 | 默认 codex=60；0=关 |

```jsonc
{
  "autoDenseBelow": 60,
  "display": {
    "showGitFileStats": true,
    "showCompactions": true,
    "showSpeed": true
  }
}
```

常用字段：

- `language`：`en`（默认）/ `zh-Hans` / `zh-Hant`
- `bold: true` — 粗体数值
- `barWidth: 14` — 进度条宽度（aesthetic 会覆盖默认）

字号由 Terminal 字体决定，状态栏无法单独放大。

---

## 主题

HUD **跟随** Grok，不锁死某一套色：

- Grok：`/theme` 或 `~/.grok/config.toml` → `[ui] theme = "…"`
- `theme = "auto"` 时：系统深色 → `auto_dark_theme`，浅色 → `auto_light_theme`
- 约 1 秒内重绘状态条

可选临时锁色（一般不必）：

```bash
GROK_HUD_LOCK=1 grok-build-hud --theme tokyonight
# 恢复跟随：
grok-build-hud --theme auto
```

浅色（如 grokday）使用纸色底 + 深字，避免白底看不清。

---

## 插件结构

本仓库按 Grok 的**插件清单约定**组织（便于本地安装），可直接 `grok plugin install .`：

```text
grok-build-hud/               # Gitea 仓库目录名
├── plugin.json                # 插件清单（name / commands / skills / hooks）
├── .grok-plugin/
│   └── marketplace.json       # 本地 marketplace 元数据
├── commands/                  # 会话斜杠命令（/hud /status /settings …）
├── skills/
│   └── grok-build-hud/        # Agent 可触发的 skill 说明
├── hooks/
│   └── hooks.json             # SessionStart / PostToolUse 等注解
├── bin/                       # CLI 入口
├── src/                       # TypeScript 源码
├── scripts/install.sh         # 一键：CLI + dashboard + 插件
├── README.md                  # 中文主文档（本文件）
└── README.en.md
```

| 组件 | 路径 | 作用 |
|------|------|------|
| Manifest | `plugin.json` | 插件名、版本、组件入口 |
| Commands | `commands/*.md` | Grok 内 `/…` 命令 |
| Skills | `skills/*/SKILL.md` | 会话技能描述 |
| Hooks | `hooks/hooks.json` | 会话生命周期注解 |
| CLI / HUD | `bin/` + `src/` | 真正画状态条与查配额 |

---

## 工作原理

1. 读本机 `~/.grok/sessions/**`（signals / updates / summary）  
2. 用已有 Grok 登录查配额  
3. 后台 daemon 写入 `~/.grok/hud/` 与按 tmux 会话隔离的状态文件  
4. 同窗口 **tmux 状态栏** 展示  

**不上传**你的代码。

---

## 卸载

```bash
# 状态条 + shell hooks
grok-build-hud --uninstall-dashboard
grok-build-hud --uninstall-hooks

# Grok 插件
grok plugin uninstall grok-build-hud

# CLI（若用过 npm link）
npm unlink -g grok-build-hud
```

可选删除：`~/.grok/hud/`、`~/.grok/hooks/grok-build-hud.json`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `command not found` | 检查 PATH；或 `node bin/grok-hud.js status` |
| 底部没有状态条 | 用 `grok` 启动；已装 tmux；执行 `bash scripts/install.sh` 或 `--install-dashboard` |
| 只有斜杠命令没有底栏 | 只装了插件；请再跑 dashboard 安装 |
| 插件未出现 | `grok plugin list`；`grok plugin enable grok-build-hud`；`/hooks` → `r` |
| 配额显示 `—` | 先 `grok login`，再 `grok-hud status` |
| 颜色不对 | `grok-build-hud --theme auto`，与 Grok 主题一致 |
| 状态不更新 | `grok-hud stop` 后重新 `grok` |
| 多终端串会话 | 更新到新版；每标签独立 `grok` |
| 字太小 | 放大 Terminal 字体；保持 `bold` / `barWidth` |
| `build missing` | `npm install && npm run build` 后再装插件 |

---

## 开发

```bash
npm install
npm test          # 编译 + 单元测试
npm run build
npm run plugin:validate   # 需本机有 grok CLI
```

- Commit message 用英文  
- 用户文档以**中文 README 为主**，英文见 [README.en.md](./README.en.md)  
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

MIT。**第三方 / 社区自研**，与 xAI 无官方从属、无官方背书；不代表 xAI 观点或产品。配额等接口以 xAI 实际 API 为准，可能变更。
