# 贡献指南

> English notes: keep commit messages in English. Primary docs are Chinese ([README.md](./README.md)); English summary: [README.en.md](./README.en.md).

## 定位

本仓库是**我们自研的第三方工具**（非 xAI 官方），以 Grok **插件机制**交付（`plugin.json` + `commands/` + `skills/` + `hooks/`），运行时依赖 Node CLI + 同窗口 tmux 状态条。文档中勿写成「官方插件」。

## 环境

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-build-hud.git
cd grok-build-hud
npm install
npm test
npm run plugin:validate   # 需本机 grok CLI
```

## 目录结构

| 路径 | 作用 |
|------|------|
| `plugin.json` | Grok 插件清单 |
| `.grok-plugin/` | 本地 marketplace 元数据 |
| `commands/` | 会话斜杠命令 |
| `skills/` | Agent skill |
| `hooks/` | Session hooks |
| `src/` | TypeScript 源码（session、billing、status、tmux、theme、CLI） |
| `bin/` | 入口：`grok-build-hud`、`grok-hud`、`grok-hud-run`、hook |
| `tests/` | Node 内置测试 (`node --test`) |
| `fixtures/` | 测试用 session / billing 样例 |
| `scripts/install.sh` | 一键：CLI + dashboard + 插件注册 |
| `README.md` | **中文主文档** |
| `README.en.md` | 英文简版 |

## 约定

- 优先读本机 `~/.grok/sessions/**`，不臆造 API  
- 配额接口离线 / 未登录时**优雅降级**（渲染路径不抛错）  
- HUD 保持**同窗口**（tmux status），默认不另开 Terminal  
- 改解析 / 渲染逻辑请补测试  
- hooks 依赖 `dist/`：改 hook 路径前确认 `npm run build`  
- **Commit message 用英文**；用户文档以中文为主  

## 提交前

```bash
npm test
# 若改了 plugin.json / commands / skills / hooks：
npm run plugin:validate
```
