# grok-build-hud

**给 [Grok Build](https://x.ai/cli) 用的 Claude-HUD 风格状态条。**

在**同一个 Terminal 窗口底部**常驻显示（用 tmux 状态栏，不会多开窗口）：

```text
[Grok 4.5] │ my-project git:(main*) │ ● LIVE
CTX ██████████░░░░ 70% (351k/500k) │ USE ███░░░░░░░░░░░ 23% weekly · 4d │ TIME 1h │ T 16 │ TOOLS 299
◐ read_file… | ✓ grep ×3 | ▸ Ship HUD (2/5)
```

> Grok 没有 Claude 那种 statusline API。本工具用「同窗口多行状态条」实现同等体验。

中文版说明见本页；英文完整文档见 [README.md](./README.md)。

---

## 需要什么

| 依赖 | 说明 |
|------|------|
| **Node.js 18+** | `node -v` 检查 |
| **tmux** | macOS：`brew install tmux` |
| **Grok Build** | 已登录：`grok login` |
| 终端 | Apple Terminal / iTerm 等（在 tmux 里跑） |

---

## 安装（三选一）

### 方式 A：从 GitHub 克隆（推荐别人安装时用）

```bash
git clone https://github.com/sooneocean/grok-build-hud.git
cd grok-build-hud
bash scripts/install.sh
```

`install.sh` 会自动：`npm install` → 编译 → `npm link` → 装 dashboard/hooks → 主题 auto → preset full。

### 方式 B：本机已有源码目录

```bash
cd /path/to/grok-build-hud
bash scripts/install.sh
# 或分步：
npm install && npm run build && npm link
npm run install-local
```

### 方式 C：当 Grok 插件（可选）

```bash
cd /path/to/grok-build-hud
npm install && npm run build
grok plugin install . --trust
grok plugin enable grok-build-hud
```

在 Grok 里执行 `/hooks` 后按 `r` 重载 hooks。

### 命令找不到时

把 npm 全局 bin 和 `~/.local/bin` 放进 PATH（写进 `~/.zshrc`）：

```bash
export PATH="$(npm prefix -g)/bin:$HOME/.local/bin:$PATH"
```

然后 `source ~/.zshrc`，再试 `which grok-hud-run`。

---

## 日常使用

```bash
# 在本标签页启动 Grok，底部自带多行 HUD（不要另开窗）
grok-hud-run
```

| 行 | 内容（类比 Claude HUD） |
|----|-------------------------|
| 第 1 行 | 模型 · 项目 · git · 是否 live · 标题 · effort |
| 第 2 行 | **上下文**进度条 + token · **配额** · 时长 · 轮次 · 工具数 · 错误 · diff |
| 第 3 行 | 最近工具 · agents · todos · GrokBuild 用量占比 |

会话开着时，状态条约每秒刷新一次。

### 常用命令

```bash
grok-hud status                         # 打印当前完整 HUD 一次
grok-build-hud --once --follow-active   # 同上
grok-hud stop                           # 停后台刷新
grok-build-hud --preset full            # 三行全开（默认）
grok-build-hud --preset essential       # 两行
grok-build-hud --preset minimal         # 一行精简
grok-build-hud --theme auto             # 跟随 Grok 主题（推荐）
grok-build-hud --theme tokyonight       # 锁定某套色
```

改完 preset/theme 后若条没变，在 tmux 里：

```bash
tmux source-file ~/.grok/hud/tmux.conf && tmux refresh-client -S
```

---

## 配置

配置文件：`~/.grok/hud/config.json`

| Preset | 行数 | 内容 |
|--------|------|------|
| **full**（默认） | 3 | 全部信息 |
| **essential** | 2 | 模型/git + 上下文/配额 + 活动 |
| **minimal** | 1 | 单行压缩 |

可读性相关：

- `bold: true` — 粗体数值（默认开）
- `barWidth: 14` — 进度条宽度  
字号由 Terminal 字体决定，tmux 状态栏不能单独放大。

主题跟 Grok：`~/.grok/config.toml` 里 `[ui] theme = "tokyonight"` 等；HUD 用 `--theme auto` 会跟着走。

---

## 工作原理（一句话）

读本机 `~/.grok/sessions/**` 的 signals / updates / summary，用你已有的 Grok 登录去查周配额；后台 daemon 写状态文件，由 **同窗口 tmux 状态栏**显示。不上传你的代码。

---

## 从 Claude HUD 迁过来

见 **[MIGRATION-FROM-CLAUDE.md](./MIGRATION-FROM-CLAUDE.md)**。

| Claude HUD | 本工具 |
|------------|--------|
| 提示符下 statusline | 同窗口 tmux 多行条 |
| Full / Essential / Minimal | `--preset full\|essential\|minimal` |
| `/claude-hud:setup` | `--install-dashboard` + `grok-hud-run` |

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
| `command not found: grok-hud-run` | 检查 PATH（见上文）；或用 `node bin/grok-hud-run.js` |
| 底部没有状态条 | 确认用 `grok-hud-run` 启动；本机已装 tmux；`grok-build-hud --install-dashboard` |
| 配额显示 `—` / n/a | 先 `grok login`；再 `grok-hud status` 看是否有 weekly |
| 颜色和 Grok 界面打架 | `grok-build-hud --theme auto`，并与 Grok `[ui].theme` 一致 |
| 状态条不更新 | `grok-hud stop` 后 `grok-hud-run`；或 `ensure` 用 `--dashboard-start` |
| 字太小 | 放大 Terminal 字体；配置里 `bold`/`barWidth` 已尽量加粗加宽 |

---

## 开发

```bash
npm install
npm test          # 编译 + 40 个单元测试
npm run build
```

---

## License

MIT。第三方工具，与 xAI 无官方从属关系；配额接口以 xAI 实际 API 为准，可能变更。
