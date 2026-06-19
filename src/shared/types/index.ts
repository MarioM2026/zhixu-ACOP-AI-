/**
 * 知墟 共享类型定义
 * 统一 AI 编程工具数据采集的数据结构
 */

// 工具类型枚举
export type ToolType = 'trae' | 'claude_code' | 'cursor' | 'github_copilot' | 'codegeex';

// AI 代码事件
export interface AICodeEvent {
  // 基础信息
  id?: string;                 // 事件 ID (服务端生成)
  sessionId: string;           // 会话 ID
  traceId: string;             // 链路 ID
  timestamp: number;           // 时间戳 (Unix ms)
  spanId?: string;            // Span ID

  // 工具信息
  tool: ToolType;              // 工具类型
  modelId: string;             // 模型标识 (如 claude-3-5-sonnet)

  // Token 消耗
  tokenConsumption: {
    input: number;            // 输入 Token 数
    output: number;           // 输出 Token 数
    total: number;            // 总 Token 数
  };

  // 性能指标
  performance: {
    latency: number;          // 响应延迟 (ms)
    ttft?: number;            // 首 Token 时间 (ms)
    totalDuration?: number;    // 总耗时 (ms)
  };

  // 质量指标
  quality?: {
    errorType?: string;        // 错误类型
    errorMessage?: string;     // 错误信息
    codeAcceptance?: boolean;  // 代码接受状态
    contextOverflow?: boolean; // 上下文溢出标记
  };

  // 成本归因
  cost?: {
    amount: number;           // 本次调用成本
    currency: string;         // 货币单位
    attribution?: string;     // 成本归属 (项目/用户/部门)
  };

  // 元数据
  metadata?: Record<string, string | number | boolean>;
}

// 指标数据 (用于规则引擎评估)
export interface MetricData {
  sessionId: string;
  timestamp: number;
  tool: ToolType;
  metrics: {
    tokenUsage: number;       // 当前 Token 使用量
    tokenLimit: number;       // Token 上限
    errorRate: number;        // 错误率
    avgLatency: number;       // 平均延迟
    requestCount: number;     // 请求次数
  };
}

// 规则定义
export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: RuleCondition;
  action: RuleAction;
  priority: 'low' | 'medium' | 'high';
}

export interface RuleCondition {
  type: 'token_threshold' | 'error_rate' | 'latency_threshold' | 'context_overflow';
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==';
}

export interface RuleAction {
  type: 'clear_context' | 'send_alert' | 'inject_prompt' | 'route_model';
  config: Record<string, string | number | boolean>;
}

// 告警信息
export interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  metadata?: Record<string, string | number | boolean>;
}

// 会话信息
export interface Session {
  id: string;
  tool: ToolType;
  startTime: number;
  endTime?: number;
  totalTokens: number;
  eventCount: number;
  status: 'active' | 'closed' | 'error';
}

// 仪表盘统计数据
export interface DashboardStats {
  totalTokens: number;
  totalRequests: number;
  avgLatency: number;
  errorRate: number;
  totalCost: number;
  activeSessions: number;
}

// 时间序列数据点
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

// Token 消耗趋势
export interface TokenTrend {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// 错误分布
export interface ErrorDistribution {
  errorType: string;
  count: number;
  percentage: number;
}

// 工具使用统计
export interface ToolUsageStats {
  tool: ToolType;
  requestCount: number;
  totalTokens: number;
  avgLatency: number;
  errorRate: number;
}

// API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

// ============================================================
// 模型路由优化 · Model Routing
// ============================================================

/** 任务类型枚举 */
export type TaskType =
  | 'code_completion'    // 代码补全
  | 'code_review'        // 代码审查
  | 'bug_fix'            // Bug 修复
  | 'refactoring'        // 重构优化
  | 'code_generation'    // 代码生成
  | 'explanation'        // 代码解释
  | 'documentation'      // 文档生成
  | 'testing'            // 测试生成
  | 'general'            // 通用对话
  | 'debugging'          // 调试诊断
  | 'optimization'       // 性能优化
  | 'security_review'    // 安全审查
  | 'architecture'      // 架构设计
  | 'migration';         // 代码迁移

/** 路由优化策略 */
export type RoutingStrategy =
  | 'cost_optimized'     // 最低成本优先
  | 'speed_optimized'    // 最快响应优先
  | 'quality_optimized'  // 最高质量优先
  | 'balanced'           // 均衡策略
  | 'custom';            // 自定义规则

/** 模型能力维度评分（1-10分） */
export interface ModelCapabilities {
  codeCompletion: number;   // 代码补全能力
  codeReview: number;       // 代码审查能力
  bugFix: number;          // Bug 修复能力
  refactoring: number;     // 重构能力
  codeGeneration: number;   // 代码生成能力
  explanation: number;      // 代码解释能力
  documentation: number;    // 文档生成能力
  testing: number;         // 测试能力
  debugging: number;       // 调试诊断能力
  securityReview: number;   // 安全审查能力
  architecture: number;    // 架构设计能力
}

/** 模型画像 */
export interface ModelProfile {
  modelId: string;                    // 模型标识（如 claude-3-5-sonnet-20241022）
  displayName: string;                // 显示名称
  provider: 'anthropic' | 'openai' | 'google' | 'deepseek' | 'qwen' | 'custom';
  // 成本（每百万 Token，美元）
  costPerMillionInput: number;
  costPerMillionOutput: number;
  // 性能基准（毫秒）
  avgLatency: number;                // 平均响应延迟
  ttft: number;                       // 首 Token 时间基准
  // 能力评分（1-10）
  capabilities: ModelCapabilities;
  // 元数据
  maxTokens: number;                 // 最大输出 Token
  contextWindow: number;             // 上下文窗口大小
  enabled: boolean;                  // 是否启用该模型
  tags: string[];                    // 标签（如 ['代码专家', '便宜', '快速']）
}

/** 路由决策结果 */
export interface RoutingDecision {
  decisionId: string;               // 决策 ID
  timestamp: number;                // 决策时间
  input: {
    taskType: TaskType;             // 识别到的任务类型
    sessionId: string;              // 会话 ID
    inputTokens: number;            // 预估输入 Token
    userIntent?: string;            // 用户意图文本（脱敏）
  };
  candidates: ModelCandidate[];     // 候选模型评分列表
  selected: {
    modelId: string;                // 最终选择的模型
    reason: string;                 // 选择理由
    confidence: number;             // 置信度（0-1）
  };
  strategy: RoutingStrategy;         // 使用的路由策略
  actualLatency?: number;            // 实际响应延迟（事后回填）
  actualTokens?: number;            // 实际消耗 Token（事后回填）
  actualQuality?: number;            // 实际质量评分（事后回填，1-5）
}

/** 候选模型评分 */
export interface ModelCandidate {
  modelId: string;
  totalScore: number;              // 综合评分（0-100）
  costScore: number;                // 成本得分
  speedScore: number;               // 速度得分
  capabilityScore: number;           // 能力匹配得分
  reason: string;                   // 该候选的优势说明
}

/** 路由规则定义 */
export interface RoutingRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  // 触发条件
  conditions: {
    taskTypes: TaskType[];          // 匹配的任务类型
    sessionPatterns?: string[];     // 会话名称匹配模式（可选）
    tokenBudget?: number;           // Token 预算上限（可选）
  };
  // 路由策略
  strategy: RoutingStrategy;
  // 强制指定模型（优先级高于策略，可选）
  forceModel?: string;
  // 排除的模型（可选）
  excludeModels?: string[];
  priority: number;                 // 规则优先级（数字越大优先级越高）
}

/** 路由统计 */
export interface RoutingStats {
  totalDecisions: number;          // 总路由决策次数
  modelUsage: Record<string, number>; // 各模型使用次数
  taskTypeDistribution: Record<TaskType, number>; // 任务类型分布
  avgLatencyByModel: Record<string, number>;     // 各模型平均延迟
  avgCostByModel: Record<string, number>;         // 各模型平均成本
  strategyUsage: Record<RoutingStrategy, number>;  // 各策略使用次数
}
