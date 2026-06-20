# 知墟详细开发与落地流程

## 目录

- [概述](#概述)
- [阶段一：开发环境准备](#阶段一开发环境准备)
- [阶段二：核心功能开发](#阶段二核心功能开发)
- [阶段三：测试验证](#阶段三测试验证)
- [阶段四：部署上线](#阶段四部署上线)
- [阶段五：运行与维护](#阶段五运行与维护)
- [附录：常用命令速查](#附录常用命令速查)

---

## 概述

> **知墟的终极目标不是"监控 AI"，而是"让 AI 自我进化"**

本文档详细描述知墟项目从开发到落地的完整流程，包含六个核心阶段：

| 阶段 | 主要产出 |
|------|---------|
| **阶段一** | 开发环境就绪、项目结构搭建 |
| **阶段二** | 核心功能实现（**规则引擎 + 反馈闭环**） |
| **阶段三** | 测试用例、测试报告 |
| **阶段四** | 生产环境部署、上线文档 |
| **阶段五** | 运维监控、迭代优化 |

### ⭐ 核心开发优先级

**第一优先级（最核心）**：规则引擎 + 反馈闭环
- 定时扫描事件数据，自动触发规则
- 执行动作：上下文清理、告警发送、Prompt 注入
- 让 AI 从错误中学习，越来越聪明

**第二优先级**：数据采集 + 可视化
- 统一数据采集（OTel GenAI 语义）
- 可视化看板

**第三优先级**：持久化 + 多工具支持
- SQLite → PostgreSQL 迁移
- Claude Code / Cursor 适配器

---

## 阶段一：开发环境准备

### 1.1 环境检查

**前置依赖检查：

```bash
# 检查 Node.js 版本
node -v  # 要求 >= 18.0.0
npm -v   # 要求 >= 9.0.0

# 检查 Python（可选，用于规则引擎）
python --version  # 要求 >= 3.10

# 检查 Docker（可选，用于容器部署）
docker --version
docker-compose --version
```

### 1.2 项目初始化

**步骤1：克隆仓库

```bash
cd zhixu-acop
```

**步骤2：安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖（可选）
pip install -r requirements.txt
```

**步骤3：配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置关键参数
# - OTEL_EXPORTER_OTLP_ENDPOINT
# - DATABASE_URL
# - PORT
```

**步骤4：初始化数据库

```bash
# 初始化 SQLite 数据库（开发环境）
mkdir -p data
npm run db:push

# 或使用 PostgreSQL（生产环境）
# 创建数据库用户和数据库
# psql -c "CREATE USER zhixu WITH PASSWORD 'your_password';"
# psql -c "CREATE DATABASE zhixu OWNER zhixu;"
```

### 1.3 项目结构

```
zhixu-acop/
├── src/
│   ├── server/           # 后端服务
│   │   ├── index.ts      # 入口文件
│   │   ├── routes/     # API 路由
│   │   ├── services/ # 业务服务
│   │   └── middleware/ # 中间件
│   ├── client/           # 前端代码
│   │   ├── src/
│   │   ├── index.html
│   │   └── vite.config.ts
│   ├── shared/           # 共享代码
│   └── __tests__/        # 测试文件
├── config/               # 配置文件
├── packages/             # 适配器包
├── docker-compose.yml    # Docker 编排
├── package.json
└── .env
```

### 1.4 启动开发服务

```bash
# 方式一：启动全部服务
npm run dev

# 方式二：分别启动
npm run dev:server  # 后端服务
npm run dev:client  # 前端服务

# 方式三：Docker 启动（推荐）
docker-compose up -d
```

**验证服务是否正常：**
- 前端访问: http://localhost:3000
- 后端 API: http://localhost:3000/api
- Grafana: http://localhost:3001

---

## 阶段二：核心功能开发

### 2.1 功能开发顺序

| 优先级 | 功能模块 | 负责人 | 预计工时 | 核心能力 |
|--------|---------|--------|---------|---------|
| P0 | OTEL 数据采集 | Dev1 | 3天 | OTel 接收器 · 数据标准化 · Trae MCP 埋点 |
| P0 | 基础监控看板 | Dev2 | 4天 | 实时指标卡片 · Token 趋势图 · 事件列表 |
| P1 | Trae 适配器 | Dev1 | 3天 | 会话数据采集 · Token 统计 · 错误分类 |
| P1 | 规则引擎 | Dev3 | 4天 | 条件匹配 · 动作执行 · 反馈闭环 |
| P1 | 自动优化动作 | Dev3 | 3天 | 上下文清理 · Prompt 注入 · 错误模式识别 |
| P2 | Claude Code 适配器 | Dev1 | 2天 | AMP 代理采集 · 统一数据模型 |
| P2 | 告警通知 | Dev2 | 2天 | 钉钉 · 邮件 · Webhook 三通道 |
| P2 | 持久化存储 | Dev2 | 3天 | SQLite → PostgreSQL / InfluxDB |

### 2.2 数据标准化（OTel GenAI 语义）

```typescript
// src/shared/types/index.ts
// 遵循 OpenTelemetry GenAI 语义规范，标准化 Span 属性

export interface AICodeEvent {
  // 基础标识
  sessionId: string;
  conversationId: string;
  timestamp: number;

  // 工具信息
  tool: 'trae' | 'claude-code' | 'cursor' | 'copilot';
  modelId: string;

  // Token 消耗（核心指标）
  tokenConsumption: {
    input: number;   // 输入 Token
    output: number;  // 输出 Token
    total: number;   // 总计
  };

  // 性能指标
  responseLatency: number;  // 响应延迟（ms）
  firstTokenLatency?: number;  // 首 Token 延迟（ms）

  // 错误信息
  errorType?: string;   // 错误类型
  errorMessage?: string; // 错误信息

  // 上下文状态
  contextHealth?: {
    usedTokens: number;      // 已用 Token
    maxTokens: number;        // 最大 Token
    usagePercent: number;     // 使用百分比
  };

  // OTel 标准属性
  attributes: {
    'gen_ai.system': string;      // AI 系统名称
    'gen_ai.model': string;       // 模型 ID
    'gen_ai.request.token_count': number;
    'gen_ai.response.token_count': number;
    'gen_ai.operation.name': string;
  };
}
```

### 2.3 Trae 适配器实现

```typescript
// packages/adapter-trae/index.ts
// Trae IDE 数据采集适配器

export class TraeAdapter implements AgentAdapter {
  private apiEndpoint: string;

  async fetchEvents(sessionId: string): Promise<AICodeEvent[]> {
    // 方式一：OTel 埋点数据
    const otelData = await this.fetchOtelData(sessionId);

    // 方式二：Trae Usage Reborn 插件数据
    const usageData = await this.fetchUsageData(sessionId);

    // 归一化处理
    return this.normalize([...otelData, ...usageData]);
  }

  async cleanupContext(sessionId: string): Promise<void> {
    // 调用 Trae MCP 清理会话指令
    await this.callMcpTool('trae.cleanup_session', { sessionId });
  }

  async injectPrompt(sessionId: string, prompt: string): Promise<void> {
    // 将优化提示注入到 Trae 对话上下文
    await this.callMcpTool('trae.inject_context', { sessionId, prompt });
  }
}
```

### 2.4 规则引擎与自动优化

```typescript
// src/server/services/ruleEngine.ts
// 规则引擎：条件匹配 + 动作执行 + 反馈闭环

export interface Rule {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  condition: {
    type: 'token_threshold' | 'error_rate' | 'latency' | 'context_overflow';
    params: Record<string, any>;
  };
  action: {
    type: 'alert' | 'cleanup' | 'inject_prompt' | 'switch_model';
    params: Record<string, any>;
  };
  enabled: boolean;
  triggerCount: number;
  lastTriggered?: number;
}

export class RuleEngine {
  // 预置规则（开箱即用）
  static readonly DEFAULT_RULES: Rule[] = [
    {
      id: 'token-over-budget',
      name: 'Token 消耗超限告警',
      priority: 'high',
      condition: { type: 'token_threshold', params: { threshold: 50000, window: '1h' } },
      action: { type: 'alert', params: { channels: ['dingtalk', 'email'] } },
      enabled: true,
      triggerCount: 0,
    },
    {
      id: 'context-overflow',
      name: '上下文 Token 占用 >80%',
      priority: 'high',
      condition: { type: 'context_overflow', params: { threshold: 0.8 } },
      action: { type: 'cleanup', params: { mode: 'auto' } },
      enabled: true,
      triggerCount: 0,
    },
    {
      id: 'error-rate-high',
      name: '错误率阈值告警',
      priority: 'high',
      condition: { type: 'error_rate', params: { threshold: 0.05, window: '30m' } },
      action: { type: 'alert', params: { channels: ['dingtalk'] } },
      enabled: true,
      triggerCount: 0,
    },
    {
      id: 'high-frequency-error',
      name: '高频语法错误 → 自动注入 Prompt',
      priority: 'medium',
      condition: { type: 'error_rate', params: { threshold: 0.3, window: '10m', errorType: 'syntax' } },
      action: { type: 'inject_prompt', params: { template: '请注意代码语法规范...' } },
      enabled: true,
      triggerCount: 0,
    },
    {
      id: 'latency-high',
      name: '延迟异常告警',
      priority: 'medium',
      condition: { type: 'latency', params: { threshold: 3000, window: '15m' } },
      action: { type: 'alert', params: { channels: ['webhook'] } },
      enabled: true,
      triggerCount: 0,
    },
  ];

  async evaluate(event: AICodeEvent): Promise<void> {
    for (const rule of this.rules.filter(r => r.enabled)) {
      if (await this.matchCondition(rule, event)) {
        await this.executeAction(rule, event);
        await this.logAction(rule, event);
      }
    }
  }

  // 反馈闭环：将错误模式注入到 Trae 对话上下文
  private async executeAction(rule: Rule, event: AICodeEvent): Promise<void> {
    switch (rule.action.type) {
      case 'cleanup':
        // 调用 Trae MCP 清理会话指令
        await this.traeAdapter.cleanupContext(event.sessionId);
        break;
      case 'inject_prompt':
        // 将优化提示注入到 Trae 对话上下文
        await this.traeAdapter.injectPrompt(event.sessionId, rule.action.params.template);
        break;
      case 'alert':
        // 触发告警
        await this.alertService.send(rule.action.params.channels, rule.name, event);
        break;
    }
  }
}
```

### 2.5 Claude Code 适配器（双模驱动）

```typescript
// packages/adapter-claude-code/index.ts
// Claude Code 数据采集：Agent Monitor Proxy (AMP) 或 ai-context-hud

export class ClaudeCodeAdapter implements AgentAdapter {
  // 方式一：AMP 代理采集
  async fetchViaAmp(sessionId: string): Promise<AICodeEvent[]> {
    const ampProxy = new AgentMonitorProxy({
      endpoint: process.env.AMP_ENDPOINT || 'http://localhost:4318',
    });
    return ampProxy.fetchEvents(sessionId);
  }

  // 方式二：ai-context-hud 插件
  async fetchViaContextHud(sessionId: string): Promise<AICodeEvent[]> {
    const hudData = await this.fetchContextHudData(sessionId);
    return this.normalize(hudData);
  }

  // 统一数据模型：遵循 OTel GenAI 语义规范
  private normalize(rawData: any[]): AICodeEvent[] {
    return rawData.map(event => ({
      sessionId: event.session_id,
      conversationId: event.conversation_id,
      timestamp: event.timestamp,
      tool: 'claude-code',
      modelId: event.model,
      tokenConsumption: {
        input: event.input_tokens,
        output: event.output_tokens,
        total: event.input_tokens + event.output_tokens,
      },
      responseLatency: event.latency_ms,
      errorType: event.error?.type,
      errorMessage: event.error?.message,
      attributes: {
        'gen_ai.system': 'Claude Code',
        'gen_ai.model': event.model,
        'gen_ai.request.token_count': event.input_tokens,
        'gen_ai.response.token_count': event.output_tokens,
        'gen_ai.operation.name': event.operation_name,
      },
    }));
  }
}
```

### 2.6 REST API 服务

```typescript
// src/server/routes/api.ts
// 封装核心指标查询，供前端及自动化引擎调用

import express from 'express';
import { ruleEngine } from '../services/ruleEngine';
import { alertService } from '../services/alertService';
import { dataStore } from '../services/dataStore';

const router = express.Router();

// 获取核心指标
router.get('/metrics', async (req, res) => {
  const { startTime, endTime, tool } = req.query;
  const metrics = await dataStore.aggregateMetrics({
    startTime: new Date(startTime as string),
    endTime: new Date(endTime as string),
    tool: tool as string,
  });
  res.json({ success: true, data: metrics });
});

// 获取 Token 趋势
router.get('/metrics/token-trend', async (req, res) => {
  const { startTime, endTime, interval } = req.query;
  const trend = await dataStore.getTokenTrend({
    startTime: new Date(startTime as string),
    endTime: new Date(endTime as string),
    interval: interval as 'hour' | 'day',
  });
  res.json({ success: true, data: trend });
});

// 触发规则（手动）
router.post('/rules/:id/trigger', async (req, res) => {
  const result = await ruleEngine.triggerManually(req.params.id);
  res.json({ success: true, data: result });
});

// 测试告警通道
router.post('/alerts/test', async (req, res) => {
  const { channel, config } = req.body;
  const result = await alertService.testChannel(channel, config);
  res.json(result);
});

// 获取会话详情
router.get('/sessions/:id', async (req, res) => {
  const session = await dataStore.getSession(req.params.id);
  res.json({ success: true, data: session });
});

// 注入优化提示到会话
router.post('/sessions/:id/inject', async (req, res) => {
  const { prompt } = req.body;
  const adapter = adapters.get(req.query.tool as string);
  await adapter.injectPrompt(req.params.id, prompt);
  res.json({ success: true });
});

export { router as apiRoutes };
```

### 2.7 开发规范

**代码风格：**
- TypeScript 必须声明类型
- 遵循 ESLint + Prettier 规范
- 函数/变量命名采用 camelCase
- 类名采用 PascalCase

**提交规范：**
```bash
# 格式：type(scope): description
git commit -m "feat(collector): 添加 OTEL 数据接收端点"
git commit -m "fix(dashboard): 修复 Token 统计错误"
git commit -m "docs(readme): 更新安装说明"
```

### 2.8 每日开发流程

```
1. 拉取最新代码
   git pull origin develop

2. 创建/更新功能分支
   git checkout -b feature/xxx

3. 编写代码
   # 实现功能
   # 添加测试

4. 运行测试
   npm run test:unit

5. 代码格式化
   npm run lint:fix
   npm run format

6. 提交代码
   git add .
   git commit -m "feat: xxx"

7. 推送分支
   git push origin feature/xxx
```

### 2.9 阶段二功能检查清单

| 功能 | 检查项 | 状态 |
|------|--------|------|
| **OTel 数据采集** | □ OTel 接收器启动成功（4318 端口） | [ ] |
| | □ Trae MCP 埋点数据能到达接收器 | [ ] |
| | □ 数据遵循 OTel GenAI 语义规范 | [ ] |
| **Trae 适配器** | □ 能获取会话列表 | [ ] |
| | □ Token 消耗数据采集完整 | [ ] |
| | □ 错误信息分类采集 | [ ] |
| | □ cleanupContext 接口可用 | [ ] |
| **规则引擎** | □ 5 条预置规则已加载 | [ ] |
| | □ 条件匹配逻辑正确 | [ ] |
| | □ 动作执行链路打通 | [ ] |
| | □ 反馈闭环：injectPrompt 可用 | [ ] |
| **Claude Code 适配器** | □ AMP 代理采集数据 | [ ] |
| | □ ai-context-hud 数据采集 | [ ] |
| | □ 统一数据模型转换正确 | [ ] |
| **告警通知** | □ 钉钉通道测试成功 | [ ] |
| | □ 邮件通道测试成功（可送达收件箱） | [ ] |
| | □ Webhook 通道测试成功 | [ ] |
| **看板** | □ 核心指标卡片数据正确 | [ ] |
| | □ Token 趋势图实时更新 | [ ] |
| | □ 近 7 天 / 14 天 / 自定义筛选正常 | [ ] |
| | □ 事件列表分页正常 | [ ] |

---

### 2.10 阶段四：实现初阶自动优化（详细实施步骤）

**目标**：实现规则引擎原型，完成上下文清理、Token 告警、错误模式注入三大自动化规则。

#### 2.10.1 规则引擎原型实现（Node.js + TypeScript）

```typescript
// src/server/services/ruleScheduler.ts（待实现文件）
// 定时任务：扫描事件数据 + 自动触发规则 + 执行动作 + 日志记录

import { logger } from './logger';
import { getRecentEvents } from './aiCodeEventService';
import { evaluateAndTriggerRules } from './ruleService';
import { sendTestAlert } from './alertService';

const INTERVAL = 60 * 1000; // 每 60 秒扫描一次（可配置）

class RuleScheduler {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(): void {
    if (this.timer) return;
    logger.info('Rule scheduler started, interval: ' + INTERVAL + 'ms');
    this.timer = setInterval(() => this.run(), INTERVAL);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Rule scheduler stopped');
    }
  }

  private async run(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // 1. 扫描最近事件
      const events = await getRecentEvents(100);
      logger.info(`Scanned ${events.length} events`);

      // 2. 评估并触发规则
      const triggered = await evaluateAndTriggerRules(events);
      logger.info(`Triggered ${triggered.length} rules`);

      // 3. 对每个触发的规则执行动作
      for (const rule of triggered) {
        await this.executeActions(rule, events);
      }
    } catch (error) {
      logger.error('Rule scheduler error', { error: String(error) });
    } finally {
      this.isRunning = false;
    }
  }

  private async executeActions(rule: any, events: any[]): Promise<void> {
    const actionType = rule.action?.type;

    switch (actionType) {
      case 'clear_context':
        // 调用 Trae MCP 清理会话
        // await traeAdapter.cleanupContext(events[0]?.sessionId);
        logger.info(`Context cleanup executed for rule ${rule.id}`);
        break;
      case 'send_alert':
        // 调用告警服务发送真实告警
        const channels = rule.action?.config?.channels || ['dingtalk', 'email', 'webhook'];
        for (const channel of channels) {
          // const config = loadAlertConfigFromStorage();
          // await sendTestAlert(channel, config[channel]);
          logger.info(`Alert sent via ${channel} for rule ${rule.id}`);
        }
        break;
      case 'inject_prompt':
        // 将错误模式注入 Trae 对话上下文
        // await traeAdapter.injectPrompt(events[0]?.sessionId, rule.action?.prompt || '请优化代码');
        logger.info(`Prompt injected for rule ${rule.id}`);
        break;
      default:
        logger.warn(`Unknown action type: ${actionType}`);
    }
  }
}

export const ruleScheduler = new RuleScheduler();
```

#### 2.10.2 基础规则配置（YAML 格式）

```yaml
# config/rules.yaml
rules:
  - name: context_cleanup
    condition: "token_usage > 0.8"
    action: "clear_context"
    priority: high

  - name: token_budget_alert
    condition: "daily_token > budget_threshold"
    action: "send_notification"
    channels: ["dingtalk", "email"]
    priority: medium

  - name: error_pattern_injection
    condition: "error_count > 5 && error_type == 'syntax'"
    action: "inject_prompt"
    template: "syntax_hint_template"
    priority: low
```

#### 2.10.3 反馈闭环实现

```typescript
// src/server/services/feedbackLoop.ts（待实现文件）
// 将看板采集的错误模式通过本地 Agent 写入 Trae 对话上下文

import { logger } from './logger';

export interface ErrorPattern {
  errorType: string;
  errorMessage: string;
  frequency: number;
  lastOccurrence: number;
  suggestedPrompt: string;
}

export class FeedbackLoop {
  // 分析错误模式
  async analyzeErrorPatterns(events: any[]): Promise<ErrorPattern[]> {
    const errorMap = new Map<string, ErrorPattern>();

    for (const event of events) {
      if (event.quality?.errorType) {
        const key = event.quality.errorType;
        const existing = errorMap.get(key) || {
          errorType: key,
          errorMessage: event.quality.errorMessage || '',
          frequency: 0,
          lastOccurrence: 0,
          suggestedPrompt: this.generateSuggestedPrompt(key),
        };
        existing.frequency++;
        existing.lastOccurrence = Math.max(existing.lastOccurrence, event.timestamp);
        errorMap.set(key, existing);
      }
    }

    return Array.from(errorMap.values()).sort((a, b) => b.frequency - a.frequency);
  }

  // 生成建议提示
  private generateSuggestedPrompt(errorType: string): string {
    const prompts: Record<string, string> = {
      syntax: '请注意代码语法规范，建议使用 ESLint 进行静态检查。',
      type_error: '请注意类型匹配，建议使用 TypeScript 严格模式。',
      timeout: '请优化代码性能，避免长时间阻塞操作。',
      default: '请检查代码逻辑，确保符合预期行为。',
    };
    return prompts[errorType] || prompts.default;
  }

  // 注入提示到 Trae 对话上下文
  async injectToContext(sessionId: string, patterns: ErrorPattern[]): Promise<void> {
    const highFrequencyPatterns = patterns.filter(p => p.frequency >= 3);

    if (highFrequencyPatterns.length === 0) {
      logger.info('No high-frequency error patterns to inject');
      return;
    }

    const prompt = this.buildInjectionPrompt(highFrequencyPatterns);
    // await traeAdapter.injectPrompt(sessionId, prompt);
    logger.info(`Injected ${highFrequencyPatterns.length} error patterns to session ${sessionId}`);
  }

  private buildInjectionPrompt(patterns: ErrorPattern[]): string {
    const items = patterns.map(p => `- ${p.errorType}: ${p.suggestedPrompt}`).join('\n');
    return `根据最近的错误模式分析，请注意以下问题：\n${items}`;
  }
}

export const feedbackLoop = new FeedbackLoop();
```

### 2.11 阶段五：标准化与扩展性设计（详细实施步骤）

**目标**：统一数据模型、实现双模驱动采集、迁移持久化存储、构建 REST API 服务。

#### 2.11.1 OTel GenAI 语义标准化

```typescript
// src/shared/types/otelGenAI.ts
// 遵循 OpenTelemetry GenAI 语义规范

export interface OtelGenAISpan {
  // 基础属性
  'gen_ai.system': string;           // AI 系统名称 (trae, claude-code, cursor)
  'gen_ai.operation.name': string;   // 操作名称 (chat, completion, embed)
  'gen_ai.request.model': string;    // 请求模型
  'gen_ai.response.model': string;   // 响应模型

  // Token 消耗
  'gen_ai.usage.input_tokens': number;
  'gen_ai.usage.output_tokens': number;

  // 性能指标
  'gen_ai.response.latency_ms': number;
  'gen_ai.response.first_token_ms'?: number;

  // 错误信息
  'error.type'?: string;
  'error.message'?: string;

  // 自定义属性
  'zhixu.session.id': string;
  'zhixu.context.usage_percent'?: number;
}
```

#### 2.11.2 双模驱动采集架构

```
┌─────────────────────────────────────────────────────────────┐
│                    知墟统一数据总线                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ OTel 接收器  │  │ Agent 代理  │  │   插件数据采集       │ │
│  │ (4318端口)  │  │   (AMP)     │  │ (ai-context-hud)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         ▲                  ▲                    ▲
         │                  │                    │
    ┌────┴────┐        ┌────┴────┐          ┌────┴────┐
    │  Trae   │        │ Claude  │          │ Cursor  │
    │ (OTel)  │        │  Code   │          │ (AMP)   │
    └─────────┘        │ (AMP)   │          └─────────┘
                       └─────────┘
```

#### 2.11.3 持久化存储迁移（SQLite → PostgreSQL）

```typescript
// scripts/migrate-to-postgres.ts
// SQLite → PostgreSQL 迁移脚本

import { Pool } from 'pg';
import sqlite3 from 'sqlite3';

async function migrateData(sqlitePath: string, pgConfig: any): Promise<void> {
  const sqliteDb = new sqlite3.Database(sqlitePath);
  const pgPool = new Pool(pgConfig);

  // 创建表结构
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS ai_code_events (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      timestamp BIGINT NOT NULL,
      tool VARCHAR(50) NOT NULL,
      model_id VARCHAR(100),
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      latency INTEGER DEFAULT 0,
      error_type VARCHAR(100),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 迁移数据
  // ...
}
```

#### 2.11.4 REST API 服务完善

```typescript
// src/server/routes/api.ts
// 封装核心指标查询，供前端及自动化引擎调用

import express from 'express';

const router = express.Router();

// 获取核心指标
router.get('/metrics', async (req, res) => {
  // GET /api/metrics?startTime=xxx&endTime=xxx&tool=trae
});

// 获取 Token 趋势
router.get('/metrics/token-trend', async (req, res) => {
  // GET /api/metrics/token-trend?days=7
});

// 获取会话详情
router.get('/sessions/:id', async (req, res) => {
  // GET /api/sessions/:id
});

// 注入优化提示到会话
router.post('/sessions/:id/inject', async (req, res) => {
  // POST /api/sessions/:id/inject { prompt: "xxx" }
});

export { router as apiRoutes };
```

### 2.12 阶段六：上线与持续迭代（详细实施步骤）

**目标**：生产部署、告警配置、A/B 测试、新工具支持、文档编写。

#### 2.12.1 生产部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      生产环境架构                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Nginx 反代  │  │  Node.js    │  │   PostgreSQL        │ │
│  │ (HTTPS)    │  │  集群       │  │   (主从复制)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Prometheus  │  │  Grafana    │  │   OTel Collector    │ │
│  │ (监控)      │  │  (看板)     │  │   (数据采集)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### 2.12.2 A/B 测试框架

```typescript
// src/server/services/abTest.ts
// 验证自动优化策略对代码接受率、错误率的提升效果

export interface ABTestConfig {
  id: string;
  name: string;
  variants: {
    control: any;    // 对照组
    treatment: any;  // 实验组
  };
  metrics: string[]; // 观察指标
  duration: number;  // 测试时长（天）
}

export class ABTestEngine {
  async createTest(config: ABTestConfig): Promise<void> {
    // 创建 A/B 测试
  }

  async assignVariant(userId: string, testId: string): Promise<string> {
    // 分配用户到对照组或实验组
    return Math.random() < 0.5 ? 'control' : 'treatment';
  }

  async recordMetric(testId: string, variant: string, metric: string, value: number): Promise<void> {
    // 记录指标数据
  }

  async analyzeResults(testId: string): Promise<any> {
    // 分析测试结果，计算显著性
  }
}
```

#### 2.12.3 数据飞轮优化

```typescript
// src/server/services/dataFlywheel.ts
// 根据数据飞轮持续优化规则库

export class DataFlywheel {
  // 分析规则效果
  async analyzeRuleEffectiveness(): Promise<any[]> {
    // 统计每个规则的触发次数、成功率、影响范围
    return [];
  }

  // 自动调整规则参数
  async optimizeRuleParameters(ruleId: string): Promise<void> {
    // 根据历史数据自动调整阈值
  }

  // 生成新规则建议
  async suggestNewRules(): Promise<any[]> {
    // 基于错误模式分析，建议新的规则
    return [];
  }
}
```

### 2.13 当前实现状态对照表

| 功能模块 | 规划状态 | 代码状态 | 备注 |
|---------|---------|---------|------|
| 规则引擎（条件评估） | ✅ 已规划 | ⚠️ 4 条规则 + 条件逻辑正确 | |
| 规则引擎（动作执行） | ✅ 已规划 | ❌ TODO，需集成 alertService | |
| 上下文清理 | ✅ 已规划 | ❌ 未实现，需调用 Trae MCP | |
| 注入提示 | ✅ 已规划 | ❌ 未实现，需调用 Trae MCP | |
| 定时调度 | ✅ 已规划 | ❌ 未实现，需 setInterval/cron | |
| 告警通道测试 | ✅ 已规划 | ⚠️ 独立测试成功（手动测试） | |
| 规则引擎与告警服务集成 | ✅ 已规划 | ❌ 未打通 | |
| 真实数据采集 | ✅ 已规划 | ❌ 伪随机数据，未接入 Trae | |
| 持久化存储 | ✅ 已规划 | ❌ 内存存储 | |
| OTel 接收器 | ✅ 已规划 | ❌ 未启用 | |

---

## 阶段三：测试验证

### 3.1 测试分层策略

| 层级 | 测试类型 | 覆盖率要求 | 工具 |
|------|---------|-----------|------|
| 单元测试 | 函数/模块级 | ≥80% | Vitest |
| 集成测试 | 模块间交互 | ≥60% | Vitest |
| E2E 测试 | 完整流程 | 核心路径 | Playwright |

### 3.2 测试用例设计

**单元测试示例：**

```typescript
// src/__tests__/services/tokenCounter.test.ts
import { describe, it, expect } from 'vitest';
import { TokenCounter } from '@/server/services/tokenCounter';

describe('TokenCounter', () => {
  it('should calculate total tokens correctly', () => {
    const counter = new TokenCounter();
    const result = counter.calculate({ input: 100, output: 200 });
    expect(result.total).toBe(300);
  });

  it('should handle zero values', () => {
    const counter = new TokenCounter();
    const result = counter.calculate({ input: 0, output: 0 });
    expect(result.total).toBe(0);
  });
});
```

**集成测试示例：**

```typescript
// src/__tests__/integration/api.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '@/server';

describe('API Integration', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
```

### 3.3 测试执行流程

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 生成覆盖率报告
npm run test:coverage
```

### 3.4 测试验收标准

| 指标 | 验收标准 |
|------|---------|
| 单元测试覆盖率 | ≥80% |
| 集成测试覆盖率 | ≥60% |
| E2E 测试通过率 | 100%（核心路径）|
| 代码审查通过率 | 至少 1 人审核通过 |

---

## 阶段四：部署上线

### 4.1 部署环境准备

**生产环境要求：**
- CPU：≥ 2 核
- 内存：≥ 4GB
- 存储：≥ 20GB

---

**环境配置：**

**Linux（Ubuntu/Debian）**

```bash
# 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createuser --interactive zhixu
sudo -u postgres createdb zhixu

# 安装 Redis（可选）
sudo apt-get install -y redis-server
```

**Windows**

```powershell
# 1. 安装 Node.js
# 访问 https://nodejs.org/ 下载并安装 Windows Installer（.msi），选择 LTS 18.x 版本
# 或使用 winget：
winget install OpenJS.NodeJS.LTS

# 2. 安装 PostgreSQL
# 方式一：使用 winget
winget install PostgreSQL.PostgreSQL.16
# 方式二：访问 https://www.postgresql.org/download/windows/ 下载安装包
# 安装完成后在 pgAdmin 中创建数据库 zhixu 和用户 zhixu

# 3. 安装 Redis（可选，Windows Subsystem for Linux 或使用 Microsoft 提供的版本）
# 推荐通过 WSL 运行 Redis
wsl
sudo apt-get install -y redis-server
# 或下载 Microsoft 维护的 Windows 版本
# https://github.com/microsoftarchive/redis/releases
```

**macOS**

```bash
# 1. 安装 Homebrew（如尚未安装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. 安装 Node.js
brew install node@18
echo 'export PATH="/usr/local/opt/node@18/bin:$PATH"' >> ~/.zshrc

# 3. 安装 PostgreSQL
brew install postgresql
# 启动服务
brew services start postgresql
# 创建数据库和用户
psql postgres
# 进入 psql 后执行：
# CREATE USER zhixu WITH PASSWORD 'your_password';
# CREATE DATABASE zhixu OWNER zhixu;
# \q

# 4. 安装 Redis（可选）
brew install redis
brew services start redis
```

### 4.2 构建项目

```bash
# 构建生产版本
npm run build

# 或使用 Docker 构建
docker build -t zhixu:latest .
```

### 4.3 部署方式

**方式一：Docker Compose 部署（推荐）**

```bash
# 复制配置文件
cp docker-compose.yml docker-compose.prod.yml

# 修改生产配置（数据库、端口等）
vim docker-compose.prod.yml

# 启动服务
docker-compose -f docker-compose.prod.yml up -d
```

**方式二：PM2 部署**

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/server/index.js --name zhixu

# 保存进程配置
pm2 save
pm2 startup
```

### 4.4 配置 Nginx（可选）

```nginx
# /etc/nginx/sites-available/zhixu
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3000/api/;
    }
}
```

### 4.5 上线检查清单

| 检查项 | 状态 |
|--------|------|
| ✅ 数据库配置正确 | [ ] |
| ✅ 环境变量配置完成 | [ ] |
| ✅ 防火墙规则开放 | [ ] |
| ✅ HTTPS 证书配置 | [ ] |
| ✅ 监控告警配置 | [ ] |
| ✅ 备份策略配置 | [ ] |

---

## 阶段五：运行与维护

### 5.1 日常运维

**服务监控：**

```bash
# 查看服务状态
docker-compose ps
# 或
pm2 status

# 查看日志
docker-compose logs -f
# 或
pm2 logs zhixu

# 重启服务
docker-compose restart
# 或
pm2 restart zhixu
```

**数据库维护：**

```bash
# 备份数据库
pg_dump zhixu > backup.sql

# 恢复数据库
psql zhixu < backup.sql

# 清理旧数据（保留30天）
DELETE FROM ai_code_events WHERE timestamp < NOW() - INTERVAL '30 days';
```

### 5.2 监控告警

**告警配置：**

| 告警类型 | 阈值 | 通知方式 |
|---------|------|---------|
| Token 超限 | 日消耗 > 100000 | 钉钉、邮件 |
| 服务异常 | 连续失败 > 3次 | 钉钉、邮件 |
| 数据库连接 | 连接数 > 80% | 邮件 |

**Grafana 告警配置：**
1. 打开 Grafana -> Alerting -> Alert rules
2. 创建新规则
3. 设置查询条件和阈值
4. 配置通知通道（钉钉/飞书/邮件）

### 5.3 迭代优化

**版本更新流程：**

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建
npm run build

# 重启服务
pm2 restart zhixu

# 或使用 Docker
docker-compose pull
docker-compose up -d
```

**性能优化建议：**

1. **数据库优化**
   - 添加索引
   - 定期清理历史数据
   - 使用连接池

2. **缓存策略**
   - 高频查询结果缓存到 Redis
   - 设置合理的过期时间

3. **负载均衡**
   - 使用 Nginx 反向代理
   - 配置多节点部署

---

## 附录：常用命令速查

### 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run lint         # 代码检查
npm run lint:fix     # 代码修复
npm run format       # 代码格式化
```

### 测试命令

```bash
npm test                 # 运行所有测试
npm run test:unit        # 单元测试
npm run test:integration # 集成测试
npm run test:e2e        # E2E 测试
npm run test:coverage    # 生成覆盖率报告
```

### 数据库命令

```bash
npm run db:migrate   # 数据库迁移
npm run db:generate  # 生成 Prisma 客户端
npm run db:push      # 同步数据库结构
npm run db:seed     # 数据填充
```

### Docker 命令

```bash
docker-compose up -d      # 启动服务
docker-compose down       # 停止服务
docker-compose logs -f    # 查看日志
docker-compose restart    # 重启服务
```

### Git 命令

```bash
git checkout develop      # 切换到开发分支
git checkout -b feature/xxx  # 创建功能分支
git commit -m "feat: xxx" # 提交代码
git push origin feature/xxx # 推送分支
```

---

## 文档版本

| 版本 | 日期 | 作者 | 更新说明 |
|------|------|------|---------|
| v1.0 | 2026-06-15 | 知墟 Team | 初始版本 |
| v1.1 | 2026-06-17 | 知墟 Team | 补全 2.2-2.6 核心能力章节；新增阶段二检查清单；补充 Windows/macOS 跨平台部署环境准备 |
| v1.2 | 2026-06-18 | 知墟 Team | 与实际代码状态对齐；确认规则引擎 executeAction 尚未集成 alertService；明确 P1 功能开发优先级 |
| v1.3 | 2026-06-18 | 知墟 Team | 补全阶段四/五/六详细实施步骤（2.10-2.12）；新增规则引擎原型、反馈闭环、OTel 标准化、双模驱动采集、持久化迁移、REST API、A/B 测试框架、数据飞轮优化等完整代码示例；与 HTML PRD 文档 6 个里程碑完全对齐 |

---

**确认后即可开始开发！🚀**
