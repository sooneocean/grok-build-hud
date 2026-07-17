# 贡献指南

> English notes: keep commit messages in English. Primary docs are Chinese ([README.md](./README.md)); English summary: [README.en.md](./README.en.md).

## 环境

```bash
git clone http://172.238.15.154:3000/Redredchen01/grok-hud.git
cd grok-hud
npm install
npm test
```

## 目录结构

| 路径 | 作用 |
|------|------|
| `src/` | TypeScript 源码（session、billing、status、tmux、theme、CLI） |
| `bin/` | 入口：`grok-build-hud`、`grok-hud`、`grok-hud-run`、hook |
| `tests/` | Node 内置测试 (`node --test`) |
| `fixtures/` | 测试用 session / billing 样例 |
| `commands/` / `skills/` | Grok 插件表面 |
| `scripts/install.sh` | 一键安装 |
| `README.md` | **中文主文档** |
| `README.en.md` | 英文简版 |

## 约定

- 优先读本机 `~/.grok/sessions/**`，不臆造 API  
- 配额接口离线 / 未登录时**优雅降级**（渲染路径不抛错）  
- HUD 保持**同窗口**（tmux status），默认不另开 Terminal  
- 改解析 / 渲染逻辑请补测试  
- **Commit message 用英文**；用户文档以中文为主  

## 提交前

```bash
npm test
```

全部测试通过后再 push。
