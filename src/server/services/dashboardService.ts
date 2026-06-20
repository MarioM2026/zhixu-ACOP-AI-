import type {
  DashboardStats,
  TokenTrend,
  ErrorDistribution,
  ToolUsageStats,
  Session,
  Alert,
  Rule,
} from '@zhixu/shared/types';
import { logger } from './logger';
import { getAlerts, getRules } from './ruleService';
import { routerService } from './routerService';
import type { RoutingStats } from '@zhixu/shared/types';

export interface RouterStats {
  totalDecisions: number;
  activeModels: number;
  topModel: string;
  topStrategy: string;
  taskTypeDistribution: Record<string, number>;
  strategyUsage: Record<string, number>;
  modelUsage: Record<string, number>;
}

// 内存存储（开发环境使用，生产环境应使用数据库）
const events: Map<string, any> = new Map();
const sessions: Map<string, Session> = new Map();

// 生成指定日期区间的 Token 趋势数据
function generateTokenTrend(startDate: Date, endDate: Date): TokenTrend[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const result: TokenTrend[] = [];
  const start = new Date(startDate.toISOString().split('T')[0]);
  const end = new Date(endDate.toISOString().split('T')[0]);
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  );

  // 伪随机种子：基于日期保证同一天相同值，同时在不同周期内变化
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start.getTime() + i * dayMs);
    const dateStr = date.toISOString().split('T')[0];
    // 使用日期字符串生成稳定伪随机
    const seed = Array.from(dateStr).reduce(
      (acc, c) => acc + c.charCodeAt(0),
      0
    );
    const r1 = (Math.sin(seed) * 10000) % 1;
    const r2 = (Math.cos(seed * 1.7) * 10000) % 1;
    const inputTokens = Math.floor((Math.abs(r1) * 60000 + 10000));
    const outputTokens = Math.floor((Math.abs(r2) * 120000 + 20000));

    result.push({
      date: dateStr,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    });
  }

  return result;
}

// 生成错误分布数据
function generateErrorDistribution(days: number): ErrorDistribution[] {
  const factor = Math.max(0.5, days / 7);
  return [
    {
      errorType: '接口超时',
      count: Math.round(15 * factor),
      percentage: 35,
    },
    {
      errorType: '语法错误',
      count: Math.round(12 * factor),
      percentage: 28,
    },
    {
      errorType: 'API 调用失败',
      count: Math.round(10 * factor),
      percentage: 23,
    },
    {
      errorType: '上下文溢出',
      count: Math.round(4 * factor),
      percentage: 9,
    },
    {
      errorType: '其他',
      count: Math.round(2 * factor),
      percentage: 5,
    },
  ];
}

// 生成工具使用统计
function generateToolUsage(days: number): ToolUsageStats[] {
  const factor = Math.max(0.5, days / 7);
  return [
    {
      tool: 'trae',
      requestCount: Math.round(156 * factor),
      totalTokens: Math.round(456789 * factor),
      avgLatency: 2100,
      errorRate: 2.1,
    },
    {
      tool: 'claude_code',
      requestCount: Math.round(98 * factor),
      totalTokens: Math.round(312456 * factor),
      avgLatency: 1850,
      errorRate: 1.8,
    },
    {
      tool: 'cursor',
      requestCount: Math.round(67 * factor),
      totalTokens: Math.round(198234 * factor),
      avgLatency: 2300,
      errorRate: 2.5,
    },
  ];
}

// 解析查询参数，返回 { days, startDate, endDate }
// 同时支持数字形式（days）和 query 对象
function parseTimeRangeQuery(query: number | string | {
  days?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  let days = 7;
  let startDate: Date;
  let endDate: Date;
  const now = new Date();
  endDate = new Date(now.toISOString().split('T')[0]);

  // 数字或纯字符串形式：days
  if (typeof query === 'number') {
    days = query;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
    return { days, startDate, endDate };
  }
  if (typeof query === 'string') {
    days = Number(query) || 7;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
    return { days, startDate, endDate };
  }

  // query 对象形式
  if (query.startDate && query.endDate) {
    startDate = new Date(query.startDate);
    endDate = new Date(query.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    }
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
    const dayMs = 24 * 60 * 60 * 1000;
    days = Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1;
  } else if (query.days) {
    days = Number(query.days) || 7;
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    startDate = new Date(endDate.getTime() - (days - 1) * dayMs);
  }

  return { days, startDate, endDate };
}

// 获取仪表盘统计数据
export async function getDashboardStats(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<DashboardStats> {
  const { days } = parseTimeRangeQuery(query ?? {});
  const factor = Math.max(0.5, days / 7);

  const allEvents: unknown[] = [];
  const baseTotalTokens = 0;
  const totalTokens = baseTotalTokens || Math.round(1234567 * factor);
  const totalRequests = Math.round(289 * factor);
  const avgLatency = 2100;
  const errorRate = Number((2.1 + (factor - 1) * 0.3).toFixed(2));
  const totalCost = Number((totalTokens * 0.00001).toFixed(2));

  return {
    totalTokens,
    totalRequests,
    avgLatency,
    errorRate,
    totalCost,
    activeSessions: 12,
  };
}

// 获取 Token 消耗趋势
export async function getTokenTrend(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<TokenTrend[]> {
  const { startDate, endDate } = parseTimeRangeQuery(query ?? {});
  return generateTokenTrend(startDate, endDate);
}

// 获取错误分布
export async function getErrorDistribution(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<ErrorDistribution[]> {
  const { days } = parseTimeRangeQuery(query ?? {});
  return generateErrorDistribution(days);
}

// 获取工具使用统计
export async function getToolUsageStats(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<ToolUsageStats[]> {
  const { days } = parseTimeRangeQuery(query ?? {});
  return generateToolUsage(days);
}

// 获取最近会话
export async function getRecentSessions(limit: number = 10): Promise<Session[]> {
  const allSessions = Array.from(sessions.values());
  return allSessions
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
    .slice(0, limit);
}

// 初始化示例数据（模块加载时调用一次）
export function initDashboardSamples() {
  try {
    logger.info('[dashboardService] 初始化模拟数据完成');
  } catch (error) {
    logger.error('[dashboardService] 初始化失败:', error);
  }
}

/** 告警趋势数据（按天统计） */
export interface AlertTrend {
  date: string;
  critical: number;
  warning: number;
  info: number;
  total: number;
}

/** 告警统计摘要 */
export interface AlertStats {
  total: number;
  critical: number;
  warning: number;
  info: number;
  acknowledged: number;
  unacknowledged: number;
}

/**
 * 获取告警趋势数据（按天统计）
 */
export async function getAlertTrend(
  query?: number | string | { days?: string; startDate?: string; endDate?: string }
): Promise<AlertTrend[]> {
  const { startDate, endDate } = parseTimeRangeQuery(query ?? {});
  const dayMs = 24 * 60 * 60 * 1000;

  // 收集时间范围内的每一天
  const days: string[] = [];
  const current = new Date(startDate.toISOString().split('T')[0]);
  const end = new Date(endDate.toISOString().split('T')[0]);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setTime(current.getTime() + dayMs);
  }

  // 从 ruleService 获取所有告警
  const allAlerts = await getAlerts();

  // 按日期统计
  const stats: Record<string, AlertTrend> = {};
  for (const date of days) {
    stats[date] = { date, critical: 0, warning: 0, info: 0, total: 0 };
  }

  for (const alert of allAlerts) {
    const date = new Date(alert.timestamp).toISOString().split('T')[0];
    if (!stats[date]) continue;
    const item = stats[date];
    if (alert.severity === 'critical') item.critical++;
    else if (alert.severity === 'warning') item.warning++;
    else item.info++;
    item.total++;
  }

  return days.map((date) => {
    const item = stats[date];
    return item;
  });
}

/**
 * 获取告警统计摘要
 */
export async function getAlertStats(): Promise<AlertStats> {
  const allAlerts = await getAlerts();

  return {
    total: allAlerts.length,
    critical: allAlerts.filter((a) => a.severity === 'critical').length,
    warning: allAlerts.filter((a) => a.severity === 'warning').length,
    info: allAlerts.filter((a) => a.severity === 'info').length,
    acknowledged: allAlerts.filter((a) => a.acknowledged).length,
    unacknowledged: allAlerts.filter((a) => !a.acknowledged).length,
  };
}

/** 规则统计项 */
export interface RuleStat {
  ruleId: string;
  ruleName: string;
  priority: 'low' | 'medium' | 'high';
  enabled: boolean;
  triggerCount: number;
  lastTriggeredAt?: number;
}

/**
 * 获取规则触发统计
 */
export async function getRuleStats(): Promise<{
  total: number;
  enabled: number;
  totalTriggers: number;
  rules: RuleStat[];
}> {
  const rules = await getRules();
  let totalTriggers = 0;

  const stats: RuleStat[] = rules.map((rule) => {
    const count = rule.triggerCount || 0;
    totalTriggers += count;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      enabled: rule.enabled,
      triggerCount: count,
      lastTriggeredAt: rule.lastTriggeredAt,
    };
  });

  // 按触发次数降序排列
  stats.sort((a, b) => b.triggerCount - a.triggerCount);

  return {
    total: rules.length,
    enabled: rules.filter((r) => r.enabled).length,
    totalTriggers,
    rules: stats,
  };
}

/**
 * 获取路由决策统计（从 routerService 聚合）
 */
export async function getRouterStats(): Promise<RouterStats> {
  const stats: RoutingStats = routerService.getStats();
  const strategyNames: Record<string, string> = {
    cost_optimized: '成本优先',
    speed_optimized: '速度优先',
    quality_optimized: '质量优先',
    balanced: '均衡策略',
    custom: '自定义',
  };

  // 找出使用最多的模型
  const modelEntries = Object.entries(stats.modelUsage).sort((a, b) => b[1] - a[1]);
  const topModel = modelEntries[0]?.[0] || '-';

  // 找出使用最多的策略
  const strategyEntries = Object.entries(stats.strategyUsage).sort((a, b) => b[1] - a[1]);
  const topStrategy = strategyEntries[0]
    ? `${strategyNames[strategyEntries[0][0]] || strategyEntries[0][0]} (${strategyEntries[0][1]}次)`
    : '-';

  return {
    totalDecisions: stats.totalDecisions,
    activeModels: modelEntries.length,
    topModel,
    topStrategy,
    taskTypeDistribution: stats.taskTypeDistribution as Record<string, number>,
    strategyUsage: stats.strategyUsage as Record<string, number>,
    modelUsage: stats.modelUsage,
  };
}
