# 🧠 知墟 · ZhiXu

**AI 编程助手统一观测与优化平台 — 让 AI 越来越聪明**

> 知墟的终极目标不是"监控 AI"，而是打造一个 **AI 进化引擎**。  
> 它通过统一的数据采集、规则引擎和反馈闭环，让 AI 编程助手从错误中学习，持续提升输出质量。

---

## ✨ 项目简介

| 属性 | 说明 |
|------|------|
| **项目名称** | 知墟 (ZhiXu - AI Code Copilot Observability Platform) |
| **项目定位** | AI 编程助手的"体检中心 + 健康管家 + 进化引擎" |
| **核心价值** | **让 AI 越来越聪明** — 反馈闭环驱动 AI 自进化 |
| **技术栈** | Node.js · Express · TypeScript · React · Vite |
| **当前状态** | 🟢 核心功能已完成 · v1.0.0 |
| **开源协议** | MIT |

---

## 🎯 想解决什么问题

在使用 Trae / Claude Code / Cursor 等 AI 编程助手的日常工作中，开发者面临以下痛点：

| 痛点 | 描述 | 影响 |
|------|------|------|
| 📊 **数据孤岛** | 多个 AI 工具各自产生数据，Token 消耗、错误率、延迟等指标分散在各处，无法统一查看和对比 | 无法量化 AI 使用效率，成本不透明 |
| 🔄 **缺少反馈闭环** | AI 产生错误后，下次会话可能还会犯同样的错误。AI 不会从历史中学习 | 重复踩坑，上下文质量难以累积提升 |
| 💰 **成本不可控** | 模型调用成本持续增长，但不知道花在了哪些场景，也无法设置预算告警 | 账单失控、难以 ROI 评估 |
| ⚠️ **被动等待问题** | 只有当 Token 超限、超时导致任务失败时才发现问题，缺少主动预警 | 影响开发体验和稳定性 |

**知墟的差异化回答：** 把"监控"升级为"进化"—— 不仅告诉你哪里有问题，还能**自动学习、注入优化提示、让 AI 越用越好**。

---

## 🚀 核心功能

### 📊 可视化看板 · Dashboard

实时掌握 AI 编程助手的运行状态：

- **Token 总览** - 输入/输出 Token 实时统计、趋势变化
- **响应延迟** - 首 Token 延迟 (TTFT)、总响应时间分析
- **错误追踪** - 超时、上下文溢出、API 错误等分类统计
- **成本分析** - 按工具、按模型、按时间维度的精细化成本统计
- **多时间维度** - 近 7 天 / 14 天 / 30 天的趋势分析

---

### 📋 事件管理 · Events

记录每一次 AI 编程事件，形成可追溯的使用历史：

- **统一事件格式** - 标准 `AICodeEvent` 数据结构，包含会话名称、Token、延迟、状态等
- **多工具统一采集** - Trae / Claude Code / Cursor 统一管理
- **事件列表与分页** - 支持时间筛选、工具筛选、状态筛选

---

### ⚙️ 规则引擎 · Rules（最核心）

知墟的灵魂 — 自定义规则驱动的自动化反馈与优化：

**规则架构：**

```
┌─────────────────────────────────────────────────────────┐
│                    Rule Engine                           │
│                                                         │
│   ┌────────────────────┐    ┌────────────────────┐    │
│   │   IF 触发条件      │ →  │  THEN 执行动作      │    │
│   │                    │    │                    │    │
│   │ • token > 阈值     │    │ • 发送告警 (钉钉)   │    │
│   │ • error_rate > N%  │    │ • 发送邮件         │    │
│   │ • latency > 阈值   │    │ • 清理上下文        │    │
│   │ • context 溢出     │    │ • 注入优化 Prompt   │    │
│   └────────────────────┘    └────────────────────┘    │
│                                                         │
│   优先级管理: 高 / 中 / 低                               │
│   启用/停用: 一键开关，无需重启                         │
└─────────────────────────────────────────────────────────┘
```

**内置规则示例：**

- 💎 **Token 消耗异常告警** - Token 使用量超过阈值且增长率异常时告警
- ⚠️ **错误率阈值告警** - 30 分钟内错误率超过 5% 时触发告警
- ⏱️ **延迟异常告警** - 平均延迟持续高于阈值时建议切换模型
- 🧹 **上下文清理提示** - 上下文大小溢出时建议清理会话

---

### 🔔 告警通知 · Alerts

多渠道、高可用的告警通知系统：

- **钉钉机器人** - 支持加签密钥、@所有人 配置
- **邮件通知 (SMTP)** - 支持 SSL/TLS 安全连接
- **Webhook 回调** - 自定义 HTTP POST 回调
- **一键测试** - 页面内直接测试发送配置是否生效
- **告警历史** - 记录每一次触发的告警及其发送结果

---

### 🔄 反馈闭环 · AI Evolution

知墟最核心的理念：**让 AI 从错误中学习**

```
                      ┌────────────────────┐
                      │   🧠 AI Evolution   │
                      └──────────┬─────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
    ┌─────▼─────┐          ┌─────▼─────┐          ┌─────▼─────┐
    │  📊 采集    │          │  🔍 分析    │          │  💡 注入    │
    │   数据     │──────────▶│   模式     │──────────▶│   Prompt   │
    │  Token/    │          │ 高频错误   │          │  优化建议  │
    │ 错误/延迟  │          │  异常行为   │          │ 到上下文   │
    └─────┬─────┘          └─────────────┘          └─────┬─────┘
          │                                               │
          │                                               │
          └───────────────────────┬───────────────────────┘
                                  │
                          ⚙️ 规则引擎 + 📈 效果验证
                                  │
                                  ▼
                            🧠 AI 越来越聪明
```

**闭环原理：**
1. **数据采集** - 采集每一次 AI 调用的 Token、延迟、错误状态
2. **模式分析** - 规则引擎扫描高频错误模式、性能瓶颈、上下文溢出
3. **执行动作** - 触发告警、清理上下文、或注入优化 Prompt
4. **效果验证** - 对比注入前后的错误率、延迟变化，验证是否有效
5. **持续优化** - 自动调整规则参数，让 AI 在你的代码库上表现越来越好

---

## 🏗️ 技术架构

```
┌────────────────────────────────────────────────────────────────────┐
│                    前端 · React + Vite + TypeScript                │
│                                                                    │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│   │ Dashboard│   │  Events  │   │  Rules   │   │ Settings │       │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘       │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
                         🔌 RESTful API
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                   后端 · Express + TypeScript                      │
│                                                                    │
│   ┌────────────────────┐     ┌────────────────────┐               │
│   │       Routes       │     │     Middleware     │               │
│   │  (REST API 路由)   │     │   (错误处理/日志)   │               │
│   └────────────────────┘     └────────────────────┘               │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────┐     │
│   │                    Services (业务逻辑)                    │     │
│   │                                                           │     │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │     │
│   │  │  Dashboard │  │  AI Code   │  │   Rule     │         │     │
│   │  │   Service  │  │   Event    │  │  Engine    │         │     │
│   │  └────────────┘  └────────────┘  └────────────┘         │     │
│   │                                                           │     │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │     │
│   │  │   Alert    │  │    Logger  │  │ OpenTel.  │         │     │
│   │  │  Service   │  │            │  │            │         │     │
│   │  └────────────┘  └────────────┘  └────────────┘         │     │
│   └─────────────────────────────────────────────────────────┘     │
│                                                                    │
│   ┌─────────────────────────────────────────────────────────┐     │
│   │              Agent Adapters · 多工具适配器               │     │
│   │                                                           │     │
│   │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │     │
│   │  │  Trae      │  │  Claude    │  │  Cursor    │         │     │
│   │  │  Adapter   │  │  Code      │  │  Adapter   │         │     │
│   │  └────────────┘  └────────────┘  └────────────┘         │     │
│   └─────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘

         数据源:      Trae · Claude Code · Cursor · ...
         存储层:      SQLite / 内存存储 (开发模式) · PostgreSQL (生产模式)
         监控协议:    OpenTelemetry (OTLP) · Prometheus · Grafana
```

---

## 📁 项目结构

```
zhixu-acop/
├── src/
│   ├── client/                    # 前端 (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/              # 页面组件
│   │   │   │   ├── Dashboard.tsx   # 仪表盘
│   │   │   │   ├── Events.tsx      # 事件列表
│   │   │   │   ├── Rules.tsx       # 规则管理
│   │   │   │   └── Settings.tsx    # 设置页面
│   │   │   ├── components/          # 通用组件
│   │   │   ├── hooks/               # 自定义 Hooks
│   │   │   ├── services/            # API 客户端
│   │   │   └── main.tsx            # 应用入口
│   │   ├── index.html
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   ├── server/                    # 后端 (Express + TypeScript)
│   │   ├── index.ts               # 应用入口
│   │   ├── routes/                # API 路由层
│   │   │   ├── aiCodeEvent.ts     # 事件路由
│   │   │   ├── dashboard.ts       # 仪表盘路由
│   │   │   ├── health.ts          # 健康检查路由
│   │   │   ├── rules.ts           # 规则管理路由
│   │   │   └── alerts.ts          # 告警配置路由
│   │   ├── services/              # 业务服务层
│   │   │   ├── aiCodeEventService.ts  # 事件管理核心
│   │   │   ├── dashboardService.ts    # 仪表盘数据聚合
│   │   │   ├── ruleService.ts         # 规则引擎核心
│   │   │   ├── alertService.ts        # 多通道告警服务
│   │   │   ├── opentelemetry.ts       # OTEL 集成
│   │   │   └── logger.ts              # 统一日志服务
│   │   └── middleware/             # 中间件
│   │       └── errorHandler.ts    # 全局错误处理
│   │
│   ├── shared/                    # 前后端共享代码
│   │   └── types/
│   │       ├── index.ts           # 核心类型定义
│   │       └── adapter.ts         # 适配器接口定义
│   │
│   └── __tests__/                # 测试 (vitest)
│       ├── unit/                 # 单元测试
│       ├── integration/          # 集成测试
│       └── e2e/                  # 端到端测试
│
├── packages/                      # 独立工具适配器包
│   ├── adapter-trae/             # Trae IDE 适配器
│   └── adapter-claude-code/     # Claude Code 适配器
│
├── scripts/                       # 项目脚本
│   ├── init-db.ts                # 数据库初始化
│   └── setup-trae-mcp.ts         # Trae MCP 配置脚本
│
├── config/                        # 运维配置
│   ├── otel-collector.yaml       # OpenTelemetry Collector 配置
│   └── prometheus.yml            # Prometheus 监控配置
│
├── .github/                       # GitHub 配置
│   ├── workflows/                # CI/CD 工作流
│   ├── ISSUE_TEMPLATE.md         # Issue 模板
│   └── PULL_REQUEST_TEMPLATE.md  # PR 模板
│
├── data/                         # 数据目录 (运行时创建)
├── logs/                         # 日志目录 (运行时创建)
│
├── Dockerfile                     # 生产构建镜像
├── Dockerfile.dev                 # 开发容器镜像
├── docker-compose.yml             # 一键编排部署
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
│
├── PRD.md                         # 产品需求文档
├── IMPLEMENTATION_GUIDE.md        # 实施指南
├── CONTRIBUTING.md                # 贡献指南
├── DEVELOPMENT.md                 # 开发规范
└── README.md                      # 本文件
```

---

## ⚡ 快速开始

### 环境要求

| 组件 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | v18.0.0 | v20 LTS |
| npm | v9.0.0 | v10 |
| 操作系统 | - | Windows 11 / macOS 14 / Linux (Kernel 5.x) |
| Docker (可选) | 24.0 | 27.0 |

### 1. 本地开发

```bash
# 第一步：克隆项目
git clone https://github.com/MarioM2026/zhixu-ACOP-AI.git
cd zhixu-ACOP-AI

# 第二步：安装依赖
npm install

# 第三步：启动开发服务器
npm run dev
```

服务启动后访问：

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端 API | http://localhost:3000/api |
| 健康检查 | http://localhost:3000/api/health |

### 2. 数据库初始化（可选）

```bash
# 初始化 SQLite 数据库
npm run db:init

# 重置数据库（会清空数据，慎用）
npm run db:reset

# 检查数据库状态
npm run db:status
```

> 未安装 `better-sqlite3` 时，系统会自动使用内存存储模式，无需任何配置即可体验。

### 3. 配置 Trae IDE（可选）

```bash
# 配置 Trae 的 MCP 以连接知墟
npm run setup:trae
# 重启 Trae IDE 后生效
```

### 4. 运行测试

```bash
# 运行全部测试
npm test

# 单元测试 (watch 模式，代码变化自动重跑)
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

**测试结果示例：**

```
 ✓ src/__tests__/unit/dashboardService.test.ts      (11 tests)
 ✓ src/__tests__/unit/aiCodeEventService.test.ts     (9 tests)
 ✓ src/__tests__/unit/ruleService.test.ts            (9 tests)
 ✓ src/__tests__/integration/api.integration.test.ts (11 tests)
 ✓ src/__tests__/e2e/workflow.e2e.test.ts            (5 tests)

 Test Files  5 passed (5)
      Tests  45 passed (45)
```

---

## 🐳 Docker 部署

### 生产环境

```bash
# 构建并启动服务
docker-compose up -d --build

# 查看容器状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 开发容器

```bash
# 使用开发 profile 启动带热重载的容器
docker-compose --profile development up zhixu-dev
```

部署完成后访问：**http://localhost:3000**

---

## 🔌 API 接口一览

### 事件管理 (`/api/events`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/events` | 记录一条 AI 代码事件 |
| GET | `/api/events` | 获取事件列表 (分页，支持筛选) |
| GET | `/api/events/:id` | 获取单条事件详情 |

### 仪表盘 (`/api/dashboard`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/dashboard/stats` | 获取核心指标统计 (Token/延迟/错误) |
| GET | `/api/dashboard/token-trend` | Token 消耗趋势 (近 7 天) |
| GET | `/api/dashboard/error-distribution` | 错误类型分布 |
| GET | `/api/dashboard/tool-usage` | 各 AI 工具使用占比统计 |
| GET | `/api/dashboard/sessions` | 最近活跃会话列表 |

### 规则引擎 (`/api/rules`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/rules` | 获取所有已配置规则 |
| POST | `/api/rules` | 创建新规则 |
| GET | `/api/rules/:id` | 获取规则详情 |
| PUT | `/api/rules/:id` | 更新规则（阈值/动作/优先级等） |
| DELETE | `/api/rules/:id` | 删除规则 |
| POST | `/api/rules/:id/trigger` | 手动触发规则 (用于测试) |

### 告警配置 (`/api/alerts`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/alerts/channels` | 获取当前告警通道配置 |
| POST | `/api/alerts/configure` | 配置/更新通道 (钉钉/邮件/Webhook) |
| POST | `/api/alerts/test` | 测试发送告警 |
| GET | `/api/alerts/history` | 告警发送历史记录 |

### 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 服务健康状态 |
| GET | `/api/health/ready` | 服务就绪检查 (Kubernetes 就绪探针) |

---

## 🎨 配置自定义规则

1. 启动服务后访问 **规则管理** 页面 (`/rules`)
2. 点击 **+ 新增规则**
3. 配置规则参数：
   - **条件类型** - Token 阈值 / 错误率 / 延迟阈值 / 上下文溢出
   - **触发阈值** - 数值阈值（如 50000 Token / 5% 错误率 / 3 秒延迟）
   - **时间窗口** - 统计窗口（15 分钟 / 30 分钟 / 1 小时）
   - **执行动作** - 发送告警（钉钉）/ 发送邮件 / 注入 Prompt / 清理上下文
   - **优先级** - 高（立即通知）/ 中 / 低
4. 保存后立即生效，无需重启服务

---

## 🔔 告警通知配置

### 钉钉机器人

1. 在钉钉群中添加 **自定义机器人**
2. 复制生成的 Webhook URL
3. 在知墟 **设置页面 → 告警通道** 中配置，或在代码中配置：

```typescript
alertService.registerChannel({
  type: 'dingtalk',
  enabled: true,
  config: {
    webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
    secret: '可选：加签密钥',
    isAtAll: false,
    atMobiles: ['可选：@特定手机号'],
  }
});
```

### 邮件通知

```typescript
alertService.registerChannel({
  type: 'email',
  enabled: true,
  config: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'your-email@gmail.com',
    password: 'your-app-password',
    from: '知墟 <zhixu@example.com>',
    to: ['admin@example.com'],
  }
});
```

### Webhook 回调

```typescript
alertService.registerChannel({
  type: 'webhook',
  enabled: true,
  config: {
    url: 'https://your-service.com/api/alert',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
  }
});
```

---

## 📊 性能与稳定

| 指标 | 数值 | 说明 |
|------|------|------|
| API 平均响应延迟 | < 50ms | 本地环境，单进程 |
| 事件并发写入 | 20+ TPS | 支持并发写入，内存模式 |
| 测试覆盖率 | 45 个测试用例全部通过 | 单元 / 集成 / E2E |
| 代码规范 | ESLint + Prettier + lint-staged | git commit 前自动检查 |
| CI/CD | GitHub Actions | 自动构建 + 测试 + 代码质量检查 |

---

## 🗺️ 路线图

### ✅ v1.0.0 — 核心功能发布

- [x] 统一数据采集层 (Trae / Claude Code 适配器)
- [x] 可视化仪表盘 (Token 统计 / 延迟分析 / 错误追踪)
- [x] 规则引擎 (阈值规则 / 上下文管理 / 优先级)
- [x] 多通道告警通知 (钉钉 / 邮件 / Webhook)
- [x] OpenTelemetry 协议集成

### 🔄 v1.1.0 — 数据增强 (开发中)

- [ ] 持久化存储 (PostgreSQL 适配器)
- [ ] 更多工具适配器 (Cursor / CodeGeex / 其他 Claude Code 同类)
- [ ] 历史数据导出 (CSV / JSON)
- [ ] 使用成本预测与预算管理
- [ ] 个人 dashboard 模板

### 🚀 v1.2.0 — 智能进化 (规划中)

- [ ] **上下文自动管理** - 基于会话重要度智能清理
- [ ] **模型路由优化** - 根据任务类型自动选择最优模型
- [ ] **Prompt 优化建议** - 分析高频错误并给出 Prompt 改进提示
- [ ] **AI 进化曲线** - 可视化展示 AI 输出质量随时间的提升

---

## 💬 常见问题

### Q: 服务启动后看不到数据？

A: 知墟需要先连接到实际的 AI 工具（如 Trae IDE）来采集数据。开发模式下也可以使用内置的模拟数据来体验完整功能。

### Q: 如何切换到持久化存储？

A: 安装 `better-sqlite3` 依赖（`npm install better-sqlite3`），然后运行 `npm run db:init`，系统会自动检测并切换到 SQLite 持久化存储。

### Q: 如何修改告警阈值？

A: 在 **规则管理** 页面可以动态调整任何规则的参数（阈值、动作、优先级等），修改后**立即生效，无需重启服务**。

### Q: 支持哪些 AI 编程工具？

A: v1.0 已原生支持 **Trae** 和 **Claude Code**。Cursor 及其他工具适配器已规划在 v1.1 中发布。得益于适配器架构，扩展新工具非常便捷。

### Q: 如何贡献新功能或修复 Bug？

A: 欢迎提交 PR！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发规范，确保通过全部测试后再提交。

---

## 📜 许可证

MIT License — 详见 [LICENSE](LICENSE) 文件。

这意味着你可以：自由使用、修改、分发、商用本项目，但需保留版权声明和许可证声明。

---

## 🤝 贡献

欢迎每一位开发者的贡献！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request
6. 等待代码审查和合并

更多规范请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [DEVELOPMENT.md](DEVELOPMENT.md)。

---

## 📚 更多文档

- **[PRD.md](PRD.md)** — 产品需求文档（详细的产品定位、功能规格、数据模型）
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** — 实施开发指南
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — 贡献者规范
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — 开发规范与最佳实践
- **[CHANGELOG.md](CHANGELOG.md)** — 版本变更日志

---

## 🌟 致谢

- 感谢 **Trae IDE** 团队，本项目基于 Trae 辅助开发完成
- 感谢所有为开源项目做出贡献的开发者
- 也感谢正在使用知墟的每一位开发者 — 你的反馈是知墟进化的动力 ✨

---

## 📮 联系与反馈

- **项目地址** : https://github.com/MarioM2026/zhixu-ACOP-AI
- **问题反馈** : https://github.com/MarioM2026/zhixu-ACOP-AI/issues
- **功能建议** : 欢迎通过 GitHub Issue 提交你的想法

> 如果这个项目对你有帮助，欢迎点个 **⭐ Star**，这是对我们最大的鼓励！

---

<p align="center">
  <sub>知墟 · ZhiXu — 让 AI 越来越聪明</sub>
</p>

<p align="center">
  <code>v1.0.0</code> · <code>更新于 2026-06-19</code>
</p>
