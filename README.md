# grok-hud

**[Grok Build](https://x.ai/cli) 实时多行状态条**

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
| 语言 | 默认**简体中文**，可切英文 / 繁體 |

仓库：http://172.238.15.154:3000/Redredchen01/grok-hud

---

## 目录

1. [依赖](#依赖)
2. [安装](#安装)
3. [日常使用](#日常使用)
4. [设定（语言 / 预设）](#设定语言--预设)
5. [状态条说明](#状态条说明)
6. [配置](#配置)
7. [主题](#主题)
8. [工作原理](#工作原理)
9. [卸载](#卸载)
10. [常见问题](#常见问题)
11. [开发](#开发)

---

## 依赖

| 依赖 | 说明 |
|------|------|
| **Node.js 18+** | `node -v` |
| **tmux** | macOS：`brew install tmux` |
| **Grok Build** | 已登录：`grok login` |
| 终端 | Terminal / iTerm 等（在 tmux 内运行即可） |

---

## 安装

### 方式 A：从 Gitea 克隆（推荐）

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
bash scripts/install.sh
```

会自动：`npm install` → 编译 → `npm link` → 装 dashboard / hooks → 主题跟随 → 预设 full → 语言中文。

### 方式 B：已有源码目录

```bash
cd /path/to/grok-hud
bash scripts/install.sh
# 或：
npm install && npm run build && npm link
npm run install-local
```

### 方式 C：作为 Grok 插件（可选）

```bash
cd /path/to/grok-hud
npm install && npm run build
grok plugin install . --trust
grok plugin enable grok-build-hud
```

在 Grok 内执行 `/hooks` 后按 `r` 重载 hooks。

### 命令找不到时

写入 `~/.zshrc`：

```bash
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

然后：

```bash
source ~/.zshrc
which grok-hud
```

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

## 设定（语言 / 预设）

```bash
# 交互设定（默认界面为中文）
grok-hud settings

# 快捷切语言
grok-hud lang zh    # 简体中文（默认）
grok-hud lang en    # English
grok-hud lang tw    # 繁體中文
```

| 命令 | 作用 |
|------|------|
| `grok-hud status` | 打印当前完整状态一次 |
| `grok-hud stop` | 停后台刷新 |
| `grok-build-hud --preset full` | 三行全开（默认） |
| `grok-build-hud --preset essential` | 两行 |
| `grok-build-hud --preset minimal` | 一行 |
| `grok-build-hud --theme auto` | 跟随 Grok 主题（推荐） |

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

常用字段：

- `language`：`zh-Hans`（默认）/ `en` / `zh-Hant`
- `bold: true` — 粗体数值
- `barWidth: 14` — 进度条宽度  
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

## 工作原理

1. 读本机 `~/.grok/sessions/**`（signals / updates / summary）  
2. 用已有 Grok 登录查配额  
3. 后台 daemon 写入 `~/.grok/hud/` 与按 tmux 会话隔离的状态文件  
4. 同窗口 **tmux 状态栏** 展示  

**不上传**你的代码。

---

## 卸载

```bash
grok-build-hud --uninstall-dashboard
grok-build-hud --uninstall-hooks
npm unlink -g grok-build-hud   # 若用过 npm link
```

可选删除：`~/.grok/hud/`、`~/.grok/hooks/grok-build-hud.json`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `command not found` | 检查 PATH；或 `node bin/grok-hud.js status` |
| 底部没有状态条 | 用 `grok` 启动；已装 tmux；执行 `--install-dashboard` |
| 配额显示 `—` | 先 `grok login`，再 `grok-hud status` |
| 颜色不对 | `grok-build-hud --theme auto`，与 Grok 主题一致 |
| 状态不更新 | `grok-hud stop` 后重新 `grok` |
| 多终端串会话 | 更新到新版；每标签独立 `grok`，勿共用旧 `grok-hud` tmux 名 |
| 字太小 | 放大 Terminal 字体；保持 `bold` / `barWidth` |

---

## 开发

```bash
npm install
npm test          # 编译 + 单元测试
npm run build
```

- Commit message 用英文  
- 用户文档以**中文 README 为主**，英文见 [README.en.md](./README.en.md)  
- 贡献说明：[CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

MIT。第三方工具，与 xAI 无官方从属关系；配额接口以 xAI 实际 API 为准，可能变更。
