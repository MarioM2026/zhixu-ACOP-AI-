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
