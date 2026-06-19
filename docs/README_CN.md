# 🧠 知墟 · ZhiXu — AI 编程助手统一观测与优化平台

> **让 AI 越来越聪明 — 观测 · 诊断 · 进化**

[![GitHub Stars](https://img.shields.io/github/stars/MarioM2026/zhixu-ACOP-AI?style=social)](https://github.com/MarioM2026/zhixu-ACOP-AI/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](package.json)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/frontend-React-blue)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## 🎯 一句话定位

**把分散在 Trae / Claude Code / Cursor / v0 等 AI 编程助手中的 Token、错误率、延迟、上下文质量，集中到一个仪表盘；并通过可扩展的规则引擎，自动把"坏的上下文"清理、"低效的模型"切换、"可优化的提示"注入。**

> 不是监控工具 — 是 AI 的"体检中心 + 健康管家 + 进化引擎"。

---

## 📊 你将获得什么

| 痛点 | 用知墟前 | 用知墟后 |
|------|----------|----------|
| 💰 **成本失控** | 月底看账单才惊觉 "Token 花在哪了" | Token 实时报表 + 成本告警 + 自动降级低效调用 |
| 🧻 **上下文糊掉** | 长对话后输出质量骤降，不知道清理什么 | 会话画像评分，一键归档/清理历史事件 |
| 📉 **看不到 ROI** | 用了 AI，但不知道它到底省多少时间/加了多少 bug | 错误率/成功率/响应速度可视化 |
| 🧩 **多工具数据孤岛** | Trae 在一份日志、Cursor 在另一处 | **统一采集 + 统一分析** |
| 🔔 **被动等问题** | 只有崩了才发现 | 规则引擎主动预警，甚至自动修复 |

---

## ✨ 核心功能

### 📈 监控看板（Dashboard）

一眼掌握全局状态：

- **Token 总览**：输入 / 输出 / 总消耗的实时与趋势
- **延迟分析**：TTFT（首 Token 延迟）、总响应时间分布
- **成本分维度**：按工具（Trae/Cursor/...）、按模型、按时间
- **错误追踪**：超时、上下文溢出、权限问题分类统计

### 📋 事件流（Events）

每次 AI 调用都留下痕迹：

- 统一事件格式 `AICodeEvent`（会话 ID / 模型 / Token / 延迟 / 状态）
- 跨工具统一采集，一屏对比不同 AI 编程助手的表现
- 搜索 / 筛选 / 分页

### 🧹 上下文管理（Context Management）

自动给"脏会话"打分，让你知道该不该清理：

- **四因子重要度评分**：时效性 · Token 量 · 代码接受率 · 任务复杂度
- **AI 决策建议**：保持 / 归档 / 清理 / 建议新建会话
- **操作历史可回溯**

### ⚙️ 规则引擎（Rules Engine） — 知墟的灵魂

让"被动监控"升级为"主动进化"：

```
IF  会话 Token > 60k  AND  错误率 > 25%   →   THEN  标记为"建议清理"
IF  模型调用延迟 > 3s  AND  高峰时段       →   THEN  自动切轻量模型
IF  TTFT > 2s                            →   THEN  注入并发调用提示
```

- 规则以 YAML / JSON 配置，无需改代码
- 动作可扩展到钉钉、邮件、Webhook

### 🧭 模型路由（Model Routing）

根据任务类型、Token 预算、当前响应速度，自动路由到最合适的模型。

---

## ⚡ 快速开始

```bash
# 克隆项目
git clone https://github.com/MarioM2026/zhixu-ACOP-AI.git
cd zhixu-ACOP-AI

# 安装依赖（Node.js ≥ 18）
npm install

# 启动后端（默认 http://localhost:3001）
npm run dev:server

# 启动前端（Vite，默认 http://localhost:3000）
npm run dev:client
```

打开浏览器：

- 前端看板：<http://localhost:3000>
- 事件 API：<http://localhost:3001/api/events>
- 上下文 API：<http://localhost:3001/api/context/sessions>

### 连接你的 AI 编程助手

1. Trae：在设置页输入 Trae 日志目录（默认 `%APPDATA%/TRAE SOLO CN/logs`），保存后自动开始扫描
2. Cursor / Claude Code：对应适配器已就绪，在 Settings 页启用即可

---

## 🏗️ 架构

```
┌─────────────────────────────────────────────────────────┐
│                      知墟 (ZhiXu)                        │
│                                                          │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│   │  Trae      │  │Cursor      │  │ Claude Code│ ...    │  ← 适配器
│   │  适配器    │  │ 适配器      │  │ 适配器     │       │
│   └──────┬─────┘  └──────┬─────┘  └──────┬─────┘       │
│          │                │                │             │
│          └────────────────┼────────────────┘             │
│                           ↓                              │
│             ┌──────────────────────────┐                │
│             │    统一事件流 (AICodeEvent)              │  ← 事件 / 会话聚合
│             └─────────────┬────────────┘                │
│                           ↓                              │
│      ┌───────────────┐ ┌────────────────┐              │
│      │  仪表板 API   │ │  上下文管理服务│              │  ← 评分、建议
│      └──────┬────────┘ └────────┬───────┘              │
│             │                    │                      │
│             └─────────┬──────────┘                      │
│                       ↓                                  │
│               ┌──────────────┐                          │
│               │   规则引擎    │                          │  ← 自动化进化
│               └──────┬───────┘                          │
│                      ↓                                  │
│            告警 / 自动清理 / 模型切换 / Prompt 注入     │
└─────────────────────────────────────────────────────────┘
```

---

## 📸 功能截图

> **监控看板**：一眼掌握你的 AI 成本与质量  
> **上下文管理**：四因子评分，让"该清理哪个会话"从直觉变成数据  
> **规则引擎**：把监控变成"主动进化"

---

## ⌨️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React · Vite · TypeScript |
| 样式 | 自定义科技风 CSS（无 UI 库依赖，可自由定制） |
| 后端 | Node.js · Express · TypeScript |
| 适配器 | Trae / Cursor / Claude Code 日志解析 |
| API | REST · JSON |
| 协议 | Apache License 2.0 |

---

## 🗺️ 路线图

- ✅ v1.0 数据采集层（Trae 适配器）
- ✅ v1.1 看板与事件流
- ✅ v1.2 上下文管理（评分 + 建议）
- 🔜 v1.3 规则引擎落地（告警 / 自动清理）
- 🔜 v2.0 模型路由 + 多适配器（Cursor / Claude Code）
- 🔜 v2.1 插件系统（扩展自己的规则）
- 🔜 v3.0 反馈闭环（自动注入优化 Prompt）

---

## 🤝 参与贡献

欢迎 Issue / PR！

- 如果你有适配新 AI 编程工具的想法，欢迎提交 `packages/adapter-xxx`
- UI / 可视化方向的改进非常受关注
- 规则引擎的 action 扩展（如飞书、企业微信、Webhook）欢迎提交

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📜 许可证

**Apache License 2.0** — 详见 [LICENSE](LICENSE)

> 这意味着你可以**自由使用、修改、分发、商用**本项目，只需保留版权与许可证声明，并在修改时明确标注。

---

## 📣 给知墟一个 Star ⭐

如果你认同"**把 AI 编程助手从监控升级到进化**"的方向，请在 GitHub 给一颗 Star：

👉 [github.com/MarioM2026/zhixu-ACOP-AI](https://github.com/MarioM2026/zhixu-ACOP-AI)

每一颗 Star 都是社区对"让 AI 越来越聪明"的认可。
