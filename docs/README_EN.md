# 🧠 ZhiXu — AI Code Copilot Observability & Optimization Platform

> **Make Your AI Smarter, Not Just Watch It**

[![GitHub Stars](https://img.shields.io/github/stars/MarioM2026/zhixu-ACOP-AI?style=social)](https://github.com/MarioM2026/zhixu-ACOP-AI/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](package.json)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/frontend-React-blue)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## 🎯 One-Line Pitch

**Unify tokens, errors, latency and context quality from Trae / Claude Code / Cursor / v0 into one dashboard — then use a pluggable rule engine to auto-clean bloated sessions, auto-switch models, and auto-inject optimization hints.**

> It's not just a monitor. It's a **"Checkup → Diagnosis → Evolution"** engine for your AI coders.

---

## 📊 Why You Need It

| Pain | Before ZhiXu | After ZhiXu |
|------|--------------|-------------|
| 💰 **Cost Bloating** | Surprised by end-of-month token bills | Live cost dashboard + alerts + auto downgrade |
| 🧻 **Dirty Context** | Output quality drops mid-session, no clue what to clean | Session health score + one-click archive / cleanup |
| 📉 **No Visible ROI** | Using AI but not sure if actually saving time or adding bugs | Error rate / success rate / response speed all visualized |
| 🧩 **Data Silos** | Trae in one log, Cursor in another | **Unified collection + unified analysis** |
| 🔔 **Passive Debug** | Only find problems when things crash | Proactive alerts + auto remediation |

---

## ✨ Core Features

### 📈 Dashboard

Instant overview, powered by real data flowing in from your AI copilot sessions.

### 📋 Events Stream

Every AI call, aggregated into a standard `AICodeEvent` format — searchable, filterable, paginated.

### 🧹 Context Management

Automatically score your sessions with a **4-factor engine**: *recency · token usage · quality · task complexity* — then recommend keep / archive / cleanup / new session.

### ⚙️ Rules Engine — The Soul of ZhiXu

Turn passive monitoring into active evolution:

```
IF  session tokens > 60k   AND  error_rate > 25%   →   MARK "cleanup recommended"
IF  model latency > 3s     AND  peak-hour           →   AUTO switch to lightweight model
IF  TTFT > 2s                                    →   INJECT parallel-call hint
```

- Rules configured via YAML/JSON, zero code
- Extensible actions: DingTalk · Email · Webhook

### 🧭 Model Routing

Route every call to the best model based on task type, token budget, and current responsiveness.

---

## ⚡ Quick Start

```bash
# Clone
git clone https://github.com/MarioM2026/zhixu-ACOP-AI.git
cd zhixu-ACOP-AI

# Install (Node.js >= 18 required)
npm install

# Backend (default: http://localhost:3001)
npm run dev:server

# Frontend (Vite, default: http://localhost:3000)
npm run dev:client
```

Then open:

- Dashboard → <http://localhost:3000>
- Events API → <http://localhost:3001/api/events>
- Context API → <http://localhost:3001/api/context/sessions>

### Connecting Your AI Copilots

1. **Trae**: Go to Settings, point it at `%APPDATA%/TRAE SOLO CN/logs`, save — scanning starts automatically.
2. **Cursor / Claude Code**: Adapters ready in Settings; just toggle them on.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         ZhiXu                           │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│   │  Trae    │  │  Cursor  │  │ Claude   │ ...          │ ← Adapters
│   │ Adapter  │  │ Adapter  │  │ Code     │              │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│        │              │              │                   │
│        └──────────────┼──────────────┘                   │
│                       ↓                                  │
│            ┌────────────────────┐                        │
│            │  Unified AICodeEvent │                        │ ← Event / session aggregation
│            └──────────┬──────────┘                        │
│                       ↓                                  │
│     ┌────────────┐ ┌──────────────┐                    │
│     │ Dashboard  │ │ Context Mgmt │                    │ ← Scoring + recommendations
│     └──────┬─────┘ └──────┬───────┘                    │
│            │              │                              │
│            └──────┬───────┘                              │
│                   ↓                                      │
│              ┌───────────┐                               │
│              │   Rules   │                               │ ← Active evolution
│              └─────┬─────┘                               │
│                    ↓                                     │
│        Alerts / Auto-cleanup / Model-switch / Hints      │
└─────────────────────────────────────────────────────────┘
```

---

## 📸 Screenshots

> **Dashboard** — one-glance view of your AI cost & quality  
> **Context Management** — 4-factor scoring: turn "which session to clean?" from gut feel into data  
> **Rules Engine** — monitoring → active evolution

---

## ⌨️ Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React · Vite · TypeScript |
| Styling | Custom sci-fi CSS, no UI lib lock-in, fully customizable |
| Backend | Node.js · Express · TypeScript |
| Adapters | Trae / Cursor / Claude Code log parsers |
| API | REST · JSON |
| License | Apache License 2.0 |

---

## 🗺️ Roadmap

- ✅ v1.0 Data collection (Trae adapter)
- ✅ v1.1 Dashboard & events stream
- ✅ v1.2 Context management (scoring + recommendations)
- 🔜 v1.3 Production-ready rules engine (alerts / auto-cleanup)
- 🔜 v2.0 Model routing + multi-adapter (Cursor / Claude Code)
- 🔜 v2.1 Plugin system
- 🔜 v3.0 Feedback loop (auto-inject optimized prompts)

---

## 🤝 Contributing

Issues and PRs are welcome:

- Got a new AI tool to integrate? Ship it as `packages/adapter-xxx`.
- UI / visualization improvements are especially high-value.
- Extend rule actions (Lark/Feishu, WeCom, more webhooks).

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📜 License

**Apache License 2.0** — see [LICENSE](LICENSE)

> You can **freely use, modify, distribute, and commercially adopt** this project. Just keep the copyright and license notice, and state any changes you made.

---

## 📣 Star the Project ⭐

If you believe "**AI copilots should evolve, not just be watched**", give us a star on GitHub:

👉 [github.com/MarioM2026/zhixu-ACOP-AI](https://github.com/MarioM2026/zhixu-ACOP-AI)

Every star is a community vote for "making AI smarter".
