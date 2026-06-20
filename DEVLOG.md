# 知墟 · 开发日志

> 项目代号：ZhiXu-ACOP（AI Code Assistant Observation Platform）
> 最后更新：**2026-06-20**

---

## 2026-06-20 · 第 4 天（今日）

### ✅ 今日完成

| # | 模块 | 内容 | 状态 |
|---|---|---|---|
| 4-1 | 类型扩展 | `Rule` 接口新增 `triggerCount`、`lastTriggeredAt` 字段 | ✅ |
| 4-2 | 规则服务 | `ruleService.executeAction()` 触发规则时更新触发计数 + 时间 | ✅ |
| 4-3 | 看板统计 | `dashboardService.getRuleStats()` 新增规则触发统计接口 | ✅ |
| 4-4 | API 路由 | 新增 `GET /api/dashboard/rule-stats` | ✅ |
| 4-5 | 前端 Dashboard | 新增「规则触发统计」卡片组件（按规则降序展示） | ✅ |
| 4-6 | 提示注入服务 | 新增 `promptInjectionService.ts` — 完整提示生成 + 持久化 | ✅ |
| 4-7 | 提示模板库 | 内置 4 类模板：上下文精简 / 错误率优化 / 延迟优化 / 上下文清理 | ✅ |
| 4-8 | 规则引擎增强 | `inject_prompt` / `clear_context` 动作类型触发提示生成 | ✅ |
| 4-9 | 提示 API | `GET /api/prompt-injections`（列表）、`PATCH /:id/status`（更新状态）、`DELETE`、`/stats`（统计） | ✅ |
| 4-10 | 前端提示中心 | `PromptInjections.tsx` 完整 UI：过滤 / 展开 / 复制 / 标记应用 | ✅ |
| 4-11 | Dashboard 卡片 | 新增提示统计卡片：总数 / 已应用 / 待处理 / 近 24 小时 | ✅ |
| 4-12 | 告警去重 | 双层去重机制：调度器 5 分钟冷却 + 告警服务 10 分钟哈希去重 | ✅ |
| 4-13 | API 验证 | 全量页面 API 验证完成：ModelRouting / Rules / Dashboard / Alerts / Context / Settings | ✅ |
| 4-14 | 规则引擎增强 | `evaluateEvents` 新增实时日志，支持 `request_count` 条件类型；`getTimeWindowMs` 按规则类型智能选择时间窗口 | ✅ |
| 4-15 | 告警闭环验证 | 基于真实 Trae 事件数据（196 条）规则评估：Token 使用率 1289438 / 200000，告警列表展示 85+ 条历史告警 | ✅ |
| 4-16 | 模型路由引擎 | `routerService.ts` 完整实现：5 种策略路由 + 任务分类识别 + 候选模型评分 + 决策历史 | ✅ |
| 4-17 | 模型画像库 | `modelProfileService.ts` 内置 10 个模型画像（Claude / GPT / DeepSeek / Qwen / Gemini），支持自定义模型 | ✅ |
| 4-18 | 路由 API | `/api/router/route` / `models` / `rules` / `stats` / `history` / `simulate` / `task-types` 完整 REST API | ✅ |
| 4-19 | 上下文事件详情 | `GET /api/context/sessions/:sessionId/events` 新增接口，`ContextManagement.tsx` 弹窗展示最近 10 条事件 | ✅ |
| 4-20 | 任务分类器 | `taskClassifier.ts` 支持 10+ 任务类型（bug_fix / debugging / code_review / refactoring / code_generation 等） | ✅ |
| 4-21 | 前端告警 Banner | `Dashboard.tsx` 页面顶部新增告警通知 Banner，显示未处理告警数量 + 最近告警摘要，点击跳转到告警页 | ✅ |
| 4-22 | Banner 组件 | 新增 `AlertBanner` 组件 + 配套 CSS（`alert-banner` / `alert-banner-warning/critical` / `pulse-glow` 动画 / `btn-outline` / `btn-ghost`） | ✅ |
| 4-23 | 告警 API 增强 | `GET /api/alerts` 支持 `limit` 和 `unacknowledged` 查询参数，返回 `total` 和 `filtered` 计数 | ✅ |
| 4-24 | 规则阈值优化 | rule-003 错误率阈值从 5% 降至 0%（任何错误即触发）；rule-004 延迟阈值从 5000ms 降至 2000ms | ✅ |
| 4-25 | 规则迁移 & 重置 | `loadFromStorage` 新增阈值迁移逻辑；新增 `POST /api/rules/reset` 重置为默认规则 | ✅ |
| 4-26 | 告警统计显示修复 | Dashboard 告警统计卡片新增"已确认"和"总计"统计项（acknowledged 字段之前被遗漏） | ✅ |
| 4-27 | Alerts 页面过滤器修复 | 新增"已处理"过滤器（`ack` filter）；修复 critical/warning/info 级别过滤不再错误排除已确认告警 | ✅ |
| 4-28 | 页面头部统计描述 | 头部描述同时显示总数 / 未处理数 / 已确认数，增强统计数字可读性 | ✅ |
| 4-29 | 告警 UI 表述歧义修复 | "✓ 已处理"按钮改为"✓ 确认处理"（操作按钮 vs 状态标签歧义）；增强"✓ 已确认"标签为带边框绿色 pill 样式 | ✅ |
| 4-30 | 未处理告警状态标签 | 未处理告警卡片右上角新增橙色"待处理"标签；已确认告警严重程度标签改为灰色，弱化视觉效果 | ✅ |
| 4-31 | 批量确认后端接口 | 新增 `acknowledgeAllAlerts()` 函数 + `POST /api/alerts/ack-all` 路由，一次性确认所有未处理告警 | ✅ |
| 4-32 | 一键处理前端按钮 | 告警页面头部右侧新增"✓ 一键处理 (N)"按钮；点击后自动切换到"全部"视图并刷新，让用户看到已确认的告警已变灰 | ✅ |

### 🔄 数据流转

```
事件触发 → evaluateCondition()
    ↓ (条件满足)
executeAction(rule, data)
    ├─ 更新 triggerCount, lastTriggeredAt
    ├─ 创建 Alert 记录
    ├─ 根据 rule.action.type:
    │   ├─ send_alert → 通过邮件/Webhook 发送
    │   └─ inject_prompt/clear_context → 调用 generatePrompt()
    │                                 ↓
    │                             promptInjectionService: 生成持久化
    │                                 ↓
    │                              写入 JSON
    └─ persistRules() → 持久化规则状态

前端 /prompts 页可查看和标记状态流转：
→ /prompts → list + 按状态过滤 → 复制内容 → 标记 applied/reviewed/dismissed
→ /dashboard → 规则统计卡片 + 提示统计卡片
```

### 🏗️ 文件变更清单

| 位置 | 操作 |
|---|---|
| `src/shared/types/index.ts` | ✏️ 修改 | `Rule` 新增 `triggerCount`, `lastTriggeredAt` |
| `src/server/services/ruleService.ts` | ✏️ 修改 | 计数更新 + inject_prompt 逻辑 + `acknowledgeAllAlerts` |
| `src/server/services/promptInjectionService.ts` | 🆕 新建 | 完整提示生成 + 存储服务 |
| `src/server/services/dashboardService.ts` | ✏️ 修改 | 新增 getRuleStats |
| `src/server/routes/promptInjection.ts` | 🆕 新建 | GET/PATCH/DELETE 路由 |
| `src/server/routes/alerts.ts` | ✏️ 修改 | 新增 `POST /api/alerts/ack-all` 批量确认路由 |
| `src/server/index.ts` | ✏️ 修改 | 新路由注册 + 服务初始化 |
| `src/client/src/pages/PromptInjections.tsx` | 🆕 新建 | 完整提示注入中心页面 |
| `src/client/src/pages/Dashboard.tsx` | ✏️ 修改 | 规则统计 + 提示统计卡片 + 告警 Banner + 已确认/总计统计卡片 |
| `src/client/src/pages/Alerts.tsx` | ✏️ 修改 | 过滤器修复 + 一键处理按钮 + UI 样式增强（待处理标签/确认处理按钮/已确认标签） |
| `src/client/src/components/Layout.tsx` | ✏️ 修改 | 侧边栏新增「提示注入中心」导航 |
| `src/client/src/App.tsx` | ✏️ 修改 | 新增路由 `/prompts` |

### 🔧 提示模板类型

| 类型 | 触发条件 | 适用场景 |
|---|---|---|
| `context_cleanup` | Token 用量 > 80% | 提示精简输出、开启新会话 |
| `error_rate_reduction` | 错误率 > 阈值 | 强化输入校验 + 防御性编程 |
| `latency_optimization` | 延迟 > 阈值 | 并发控制 + 流式输出建议 |
| `token_management` | Token 总量异常 | 提示上下文管理策略 |

---

## 2026-06-19 · 第 3 天（回顾）

### ✅ 今日完成

| # | 模块 | 内容 | 状态 |
|---|---|---|---|
| 3-1 | Trae 适配器 | 修复 `listLogFiles` 递归扫描子目录，支持深层嵌套日志路径（`logs/<时间戳>/Modular/ai-agent_*.log`） | ✅ |
| 3-2 | Trae 适配器 | 新增 `parseTraeLog` 专用解析器，从 Rust Tracing 日志按 `session_id` 聚合并提取模型/时长/token 估算 | ✅ |
| 3-3 | Trae 适配器 | 增量扫描逻辑：记录上次文件大小（`processedFileMap`），只读取新增长度，避免重复解析 | ✅ |
| 3-4 | Trae 适配器 | 状态持久化：`processedFileMap` + `metrics` 落盘到 `%APPDATA%/zhixu-acop-state/trae-adapter-state.json` | ✅ |
| 3-5 | 前端 API | 修复 `ContextManagement.tsx` 所有 API 调用路径缺失 `/api` 前缀（`/context/sessions` → `/api/context/sessions` 等 5 处） | ✅ |
| 3-6 | 前端 UI | **上下文管理页面 UI 风格重构**：从原生 Tailwind 改为全站统一的科技风 CSS 框架（`page` / `card-panel` / `panel-title` / `badge` / `tab-bar` 等） | ✅ |
| 3-7 | 前端 UI | 全局 CSS 补充：`tab-bar/tab-btn`、`progress-bar-container/fill`、`grid-2col`、`detail-stats/grid/actions`、`input/select` 统一表单样式 | ✅ |
| 3-8 | 页面验证 | 使用本地 Chrome + Playwright 自动化验证 `/events` 与 `/context` 页面正常渲染、无 JS 语法错误、表格/卡片/Tab 齐全 | ✅ |

### 🐛 问题追溯与修复路径

**问题 A · "输入目录后显示事件为 0"**
- 根因 1：`listLogFiles` 只扫描顶层目录，未进入 `logs/<时间戳>/Modular/` 子目录
- 根因 2：通用解析器 `parseGenericContent` 不识别 Rust Tracing 字段格式（`session_id=... duration=...ms`）
- 修复：递归扫描深度 ≥4 层 + `parseTraeLog` 专用解析器（按 `session_id` 聚合，正则匹配 `total_duration/duration`，估算 tokens）

**问题 B · "上下文管理页面空白"**
- 根因 1：前端 `api.get('/context/sessions')` 路径缺少 `/api` 前缀 → Vite 代理不转发 → 404
- 根因 2：页面使用原生 Tailwind，与 `Events.tsx` / `Dashboard.tsx` 采用的自定义 CSS 框架风格不一致
- 修复：所有 API 调用补 `/api` 前缀 + 按科技风框架重写页面结构

### 📊 当前状态

- 后端服务：`http://localhost:3001` ✅
- 前端开发服务器：`http://localhost:3000` ✅
- Trae 适配器：启用中，扫描路径 `C:/Users/11971/AppData/Roaming/TRAE SOLO CN/logs` ✅
- 事件总量：258，告警总量：103，规则：4 条 ✅
- 上下文管理页面：正常显示会话画像 / 重要度评分 / 风险标签 / 建议操作 ✅
- Dashboard 告警 Banner：已启用，显示未处理告警数量与最新告警摘要 ✅

---

## 2026-06-18 · 第 2 天（回顾）

| # | 模块 | 内容 | 状态 |
|---|---|---|---|
| 2-1 | 后端路由 | `/api/adapters`、`/api/events`、`/api/context/sessions`、`/api/dashboard` 接口对齐 | ✅ |
| 2-2 | 前端页面 | `Dashboard` / `Events` / `Rules` / `ModelRouting` / `Settings` 页基础结构完成 | ✅ |
| 2-3 | 适配器 | Trae / Cursor / Claude Code 三类适配器框架（`adapterService` 统一管理） | ✅ |
| 2-4 | 数据存储 | `storageService` 事件持久化 + 内存索引 | ✅ |
| 2-5 | 规则引擎 | `ruleService` 基础规则匹配能力 | ✅ |

---

## 2026-06-17 · 第 1 天（项目启动）

| # | 模块 | 内容 | 状态 |
|---|---|---|---|
| 1-1 | 项目脚手架 | TypeScript + Node.js + Express + React + Vite + Vitest | ✅ |
| 1-2 | 目录结构 | `src/client` / `src/server` / `src/shared` / `packages/adapter-*` 分层 | ✅ |
| 1-3 | 共享类型 | `src/shared/types/*` 定义 `AICodeEvent` / `Adapter` / `Rule` 核心类型 | ✅ |
| 1-4 | CI/CD | GitHub Actions `ci.yml` + issue/pr 模板 | ✅ |

---

## 后续开发阶段规划

### 🔵 阶段 1 · 基础功能闭环 — ✅ 已完成
**目标：确保每一个页面都能正确请求 API 并渲染，不出现空白/404**

- [x] **模型路由页面** `ModelRouting.tsx`：
  - ✅ API 已验证：`/api/router/models`、`/api/router/rules`、`/api/router/stats`、`/api/router/simulate`
  - ✅ UI 已采用科技风框架
- [x] **规则管理页面** `Rules.tsx`：
  - ✅ `/api/rules` CRUD 完整，支持新增/删除/编辑/触发
- [x] **仪表板页面** `Dashboard.tsx`：
  - ✅ `/api/dashboard/*` 系列接口完整，数据绑定正常
- [x] **设置页面** `Settings.tsx`：
  - ✅ 适配器管理支持路径配置 + 立即扫描
  - ✅ 告警通道配置支持钉钉/邮件/Webhook
- [x] **告警页面** `Alerts.tsx`：
  - ✅ `/api/alerts` 接口正常，去重机制已实现

### 🟢 阶段 2 · 上下文管理功能增强 — ✅ 已完成
**目标：从"能显示列表"进化到"能辅助决策清理"**

- [x] **重要度评分算法完善**（`contextManagerService.ts`）：
  - ✅ 时效性：按最后活跃时间衰减（越近越重要）
  - ✅ Token 使用量：高 token 会话优先保留
  - ✅ 质量：代码接受率、错误率加权
  - ✅ 任务复杂度：多分类任务数
  - ✅ 四因子权重可在前端查看
- [x] **清理建议可信度**：
  - ✅ `建议新建`：高 token 但低代码接受率 + 近期上下文溢出
  - ✅ `建议归档`：长时间不活跃 + 高重要度
  - ✅ `建议清理`：长时间不活跃 + 低重要度
- [x] **会话详情增强**：
  - ✅ 新增 `GET /api/context/sessions/:sessionId/events` 接口
  - ✅ 会话详情弹窗显示最近 10 条事件（时间/模型/Token/延迟/状态）
- [x] **增量扫描稳定性**（基础实现已到位，持续使用中优化）

### 🟡 阶段 3 · 模型路由与规则引擎 — ✅ 核心已实现
**目标：从"能看数据"进化到"能控制 AI 行为"**

- [x] **模型路由规则引擎**（`routerService.ts`）：
  - ✅ 按任务类型路由到不同模型（`taskClassifier.ts` 自动分类）
  - ✅ 5 种路由策略：`cost_optimized` / `speed_optimized` / `quality_optimized` / `balanced` / `custom`
  - ✅ 模型画像能力评分 + 综合得分选择
  - ✅ 规则热加载（无需重启服务，通过 API 更新）
  - ✅ 路由决策历史记录 + 实际结果回填
- [x] **路由规则 CRUD**：
  - ✅ 内置 3 条默认规则（成本敏感 / 质量关键 / 速度优先）
  - ✅ 支持优先级排序
  - ✅ 模拟路由接口 `POST /api/router/simulate`（输入文本预览命中情况）
- [x] **告警服务**（`alertService.ts`）：
  - ✅ 连续高 Token 消耗触发告警
  - ✅ 异常使用模式 → 触发上下文清理建议
  - ✅ 邮件 / Webhook / 钉钉通道

### 🟠 阶段 4 · 多适配器扩展 — 🟡 部分完成
**目标：Trae 之外，支持 Cursor / Claude Code**

- [x] **Trae 适配器**（`traeAdapter.ts`）：
  - ✅ 日志路径：`%APPDATA%/TRAE SOLO CN/logs`
  - ✅ Rust Tracing 格式解析（`session_id` 聚合）
  - ✅ 增量扫描（记录文件偏移量，避免重复解析）
  - ✅ 状态持久化
- [x] **Cursor 适配器**（`cursorAdapter.ts`）：
  - ✅ 基本结构已实现
  - 🟡 实际日志格式验证（需有真实 Cursor 使用数据）
- [x] **Claude Code 适配器**（`claudeCodeAdapter.ts`）：
  - ✅ 基本结构已实现
  - 🟡 实际日志格式验证
- [ ] **适配器统一管理**：
  - 🟡 多适配器并发扫描状态指示优化

### 🔴 阶段 5 · 测试、部署、性能优化 — 🟡 基础可用
**目标：从"能跑"进化到"可发布"**

- [ ] **单元测试补全**：
  - 🟡 `parseTraeLog` 边界 case（空文件、异常 session_id、超大 duration）
  - 🟡 `contextManagerService` 的评分算法断言
  - 🟡 `adapterUtils` 的递归扫描、增量扫描逻辑
- [ ] **E2E 测试**：
  - 🟡 启动服务 → 设置 Trae 路径 → 等待扫描 → 验证 `/events` / `/context/sessions` 返回数据
- [ ] **性能优化**：
  - 🟡 事件存储持久化到 SQLite（当前为 JSON 文件）
  - 🟡 查询分页避免前端渲染阻塞
  - 🟡 日志扫描节流（新文件快速响应，旧文件定期扫描）
- [ ] **Docker 部署**：
  - 🟡 多阶段构建验证
  - 🟡 日志路径 volume 挂载说明
  - 🟡 首次启动引导（检查 Trae 路径、引导用户填入）

---

## 优先级总览（P0 > P1 > P2）

| P0（阻断性，必须先修） | P1（核心功能，本周内） | P2（增强，下周起） |
|---|---|---|
| ✅ 阶段 1~3 核心功能闭环 | 🟡 多适配器实际日志验证（Cursor / Claude Code） | 🟡 单元测试补全 |
| ✅ 设置页面路径保存 & 扫描 | 🟡 前端告警通知（Toast / Banner） | 🟡 事件数据迁移到 SQLite |
| ✅ 上下文 API / 规则 / 告警数据完整 | 🟡 路由规则模板（调试/编码场景） | 🟡 Docker 部署验证 |

### 📊 当前技术架构概览

**后端（15 个服务，9 条路由）**
| 层级 | 模块 | 说明 |
|---|---|---|
| 核心 | `ruleService` | 规则引擎：条件评估 + 动作执行 + 去重 |
| 核心 | `scheduler` | 调度器：每 60 秒扫描规则 |
| 核心 | `alertService` | 告警分发：邮件 / Webhook / 钉钉 |
| 核心 | `routerService` | 模型路由：5 种策略 + 任务分类 |
| 核心 | `contextManagerService` | 上下文画像：四因子评分 + 清理建议 |
| 数据 | `aiCodeEventService` | 事件聚合 + 持久化 |
| 数据 | `modelProfileService` | 10 个模型画像库 |
| 数据 | `promptInjectionService` | 提示注入模板生成 |
| 工具 | `taskClassifier` | 任务类型识别（10+ 种类型） |
| 采集 | `adapterService` | 统一管理 Trae / Cursor / Claude Code 适配器 |
| 存储 | `storageService` | JSON 文件持久化 |

**前端（8 个页面，科技风 CSS 框架）**
| 页面 | 路径 | 核心功能 |
|---|---|---|
| Dashboard | `/dashboard` | 全局指标 + 规则触发 + 提示统计卡片 |
| Events | `/events` | AI 调用事件流，搜索/筛选/分页 |
| Rules | `/rules` | 规则管理（CRUD + 手动触发） |
| ModelRouting | `/model-routing` | 模型画像 + 路由规则 + 模拟路由 |
| ContextManagement | `/context` | 会话画像 + 重要度评分 + 清理建议 |
| Alerts | `/alerts` | 告警历史（过滤 / 一键处理 / 单条确认 / 已确认灰色样式 / 待处理标签） |
| PromptInjections | `/prompts` | 提示注入中心（过滤 / 复制 / 标记应用） |
| Settings | `/settings` | 适配器配置 + 告警通道配置 |

### 🎯 下一优先级

**立即可以推进的工作**（按优先级）：

1. **P1 · 前端告警通知**：在 Dashboard / Events 页面，对最近触发的告警显示 Toast 或右上角 Banner
2. **P1 · 路由规则模板扩展**：增加"编码场景用 qwen-plus"、"复杂任务用 Claude"等预置规则
3. **P2 · 单元测试**：为 `taskClassifier` / `contextManagerService` 的评分逻辑补充断言
4. **P2 · SQLite 持久化**：从 JSON 文件迁移到 SQLite，支持更大规模事件数据

> **当前进度估计**：阶段 1~3 核心功能（≈ 80%）已完成；阶段 4~5 为增强与部署（需要有真实数据/使用场景后持续迭代）。
