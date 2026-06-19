import { v4 as uuidv4 } from 'uuid';
import type { Rule, MetricData, Alert } from '@zhixu/shared/types';
import { logger } from './logger';
import { getRecentEvents } from './aiCodeEventService';
import { sendAlert, getEnabledChannels } from './alertService';
import { loadJSON, schedulePersist } from './storageService';

const STORAGE_KEY_RULES = 'alert-rules';
const STORAGE_KEY_ALERTS = 'alert-history';

const rules: Map<string, Rule> = new Map();
const alerts: Map<string, Alert> = new Map();

function getDefaultRules(): Rule[] {
  return [
    {
      id: 'rule-001',
      name: '上下文清理预警',
      description: '当 Token 使用超过 80% 时触发',
      enabled: true,
      condition: {
        type: 'token_threshold',
        threshold: 0.8,
        operator: '>',
      },
      action: {
        type: 'clear_context',
        config: { message: '上下文即将溢出，建议清理' },
      },
      priority: 'high',
    },
    {
      id: 'rule-002',
      name: 'Token 超预算告警',
      description: '单日 Token 消耗超过阈值时发送告警',
      enabled: true,
      condition: {
        type: 'token_threshold',
        threshold: 100000,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['email', 'dingtalk']) },
      },
      priority: 'medium',
    },
    {
      id: 'rule-003',
      name: '错误率过高告警',
      description: '当错误率超过 5% 时触发',
      enabled: true,
      condition: {
        type: 'error_rate',
        threshold: 5,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['dingtalk']) },
      },
      priority: 'medium',
    },
    {
      id: 'rule-004',
      name: '延迟过高告警',
      description: '当平均延迟超过 5000ms 时触发',
      enabled: true,
      condition: {
        type: 'latency_threshold',
        threshold: 5000,
        operator: '>',
      },
      action: {
        type: 'send_alert',
        config: { channels: JSON.stringify(['dingtalk']) },
      },
      priority: 'low',
    },
  ];
}

export async function loadFromStorage(): Promise<void> {
  const savedRules = await loadJSON<Rule[]>(STORAGE_KEY_RULES, []);
  if (savedRules.length > 0) {
    savedRules.forEach((rule) => rules.set(rule.id, rule));
    logger.info(`[Rules] 从持久化加载 ${savedRules.length} 条规则`);
  } else {
    const defaults = getDefaultRules();
    defaults.forEach((rule) => rules.set(rule.id, rule));
    logger.info(`[Rules] 首次启动，注入 ${defaults.length} 条默认规则`);
    schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
  }

  const savedAlerts = await loadJSON<Alert[]>(STORAGE_KEY_ALERTS, []);
  savedAlerts.forEach((alert) => alerts.set(alert.id, alert));
  logger.info(`[Alerts] 从持久化加载 ${savedAlerts.length} 条告警记录`);
}

function persistRules(): void {
  schedulePersist(STORAGE_KEY_RULES, () => Array.from(rules.values()));
}

function persistAlerts(): void {
  schedulePersist(STORAGE_KEY_ALERTS, () => Array.from(alerts.values()));
}

// 获取所有规则
export async function getRules(): Promise<Rule[]> {
  return Array.from(rules.values());
}

// 获取单个规则
export async function getRuleById(id: string): Promise<Rule | null> {
  return rules.get(id) || null;
}

// 创建规则
export async function createRule(rule: Rule): Promise<Rule> {
  const newRule: Rule = {
    ...rule,
    id: rule.id || uuidv4(),
  };
  rules.set(newRule.id, newRule);
  logger.info(`Rule created: ${newRule.id}`, { name: newRule.name });
  persistRules();
  return newRule;
}

// 更新规则
export async function updateRule(id: string, rule: Rule): Promise<Rule | null> {
  if (!rules.has(id)) {
    return null;
  }
  const updatedRule = { ...rule, id };
  rules.set(id, updatedRule);
  logger.info(`Rule updated: ${id}`, { name: rule.name });
  persistRules();
  return updatedRule;
}

// 删除规则
export async function deleteRule(id: string): Promise<void> {
  rules.delete(id);
  logger.info(`Rule deleted: ${id}`);
  persistRules();
}

// 执行动作，返回创建的告警
async function executeAction(rule: Rule, metricData: MetricData): Promise<Alert> {
  const alert: Alert = {
    id: uuidv4(),
    ruleId: rule.id,
    severity:
      rule.priority === 'high' ? 'critical' : rule.priority === 'medium' ? 'warning' : 'info',
    title: `规则触发: ${rule.name}`,
    message: `规则 "${rule.name}" 的条件已满足 (${rule.condition.type} > ${rule.condition.threshold}). 触发动作: ${rule.action.type}`,
    timestamp: Date.now(),
    acknowledged: false,
    metadata: {
      tokenUsage: String(metricData.metrics.tokenUsage),
      errorRate: String(metricData.metrics.errorRate),
      avgLatency: String(metricData.metrics.avgLatency),
      requestCount: String(metricData.metrics.requestCount),
    },
  };

  alerts.set(alert.id, alert);
  logger.info(`Alert generated: ${alert.id}`, { ruleId: rule.id, action: rule.action.type, severity: alert.severity });
  persistAlerts();

  // 根据动作类型执行相应操作
  const actionType = rule.action.type;
  if (actionType === 'send_alert' || actionType === 'clear_context' || actionType === 'inject_prompt' || actionType === 'route_model') {
    // 所有规则动作都发送告警（核心功能）
    // 如果规则的 action.config.channels 指定了通道，使用指定的；否则使用所有已启用的通道
    let channels: string[] = [];
    const rawChannels = rule.action.config.channels;
    if (Array.isArray(rawChannels)) {
      channels = rawChannels as string[];
    } else if (typeof rawChannels === 'string' && rawChannels.length > 0) {
      try {
        channels = JSON.parse(rawChannels) as string[];
      } catch {
        channels = [rawChannels];
      }
    }
    if (channels.length === 0) {
      channels = getEnabledChannels();
    }

    if (channels.length > 0) {
      try {
        const result = await sendAlert(alert, channels);
        const successCount = result.results.filter((r) => r.success).length;
        const totalCount = result.results.length;
        logger.info(`Alert delivered: ${successCount}/${totalCount} channels`, { alertId: alert.id, results: result.results });
      } catch (error) {
        logger.error(`Failed to deliver alert`, { alertId: alert.id, error: String(error) });
      }
    } else {
      logger.warn(`No alert channels configured, alert stored only in memory`, { alertId: alert.id });
    }
  }

  return alert;
}

// 触发规则（支持评估并执行）
export async function triggerRule(id: string): Promise<{ triggered: boolean; alert?: Alert; error?: string }> {
  const rule = rules.get(id);
  if (!rule) {
    return { triggered: false, error: `Rule not found: ${id}` };
  }

  if (!rule.enabled) {
    return { triggered: false, error: 'Rule is disabled' };
  }

  // 获取最近的事件数据用于评估
  const events = await getRecentEvents(100);
  const metricData = evaluateEvents(events);

  // 检查条件是否满足
  if (evaluateCondition(rule, metricData)) {
    const generatedAlert = await executeAction(rule, metricData);
    return { triggered: true, alert: generatedAlert };
  }

  return { triggered: false };
}

// 评估事件数据
function evaluateEvents(events: any[]): MetricData {
  const now = Date.now();
  const oneHourMs = 60 * 60 * 1000;

  // 计算最近一小时的数据
  const recentEvents = events.filter((e) => now - e.timestamp < oneHourMs);

  const totalTokens = recentEvents.reduce((sum, e) => sum + (e.tokenConsumption?.total || 0), 0);
  const errorCount = recentEvents.filter((e) => e.quality?.errorType).length;
  const totalLatency = recentEvents.reduce((sum, e) => sum + (e.performance?.latency || 0), 0);

  return {
    sessionId: 'current',
    timestamp: now,
    tool: 'trae',
    metrics: {
      tokenUsage: totalTokens,
      tokenLimit: 200000,
      errorRate: recentEvents.length > 0 ? (errorCount / recentEvents.length) * 100 : 0,
      avgLatency: recentEvents.length > 0 ? totalLatency / recentEvents.length : 0,
      requestCount: recentEvents.length,
    },
  };
}

// 评估条件
function evaluateCondition(rule: Rule, data: MetricData): boolean {
  const { condition } = rule;
  const value =
    condition.type === 'token_threshold'
      ? condition.threshold <= 1 // 如果阈值 <= 1，按百分比计算
        ? data.metrics.tokenUsage / data.metrics.tokenLimit
        : data.metrics.tokenUsage
      : condition.type === 'error_rate'
        ? data.metrics.errorRate
        : condition.type === 'latency_threshold'
          ? data.metrics.avgLatency
          : 0;

  switch (condition.operator) {
    case '>':
      return value > condition.threshold;
    case '<':
      return value < condition.threshold;
    case '>=':
      return value >= condition.threshold;
    case '<=':
      return value <= condition.threshold;
    case '==':
      return value === condition.threshold;
    default:
      return false;
  }
}

// 获取告警列表
export async function getAlerts(): Promise<Alert[]> {
  return Array.from(alerts.values()).sort((a, b) => b.timestamp - a.timestamp);
}

// 确认告警
export async function acknowledgeAlert(id: string): Promise<void> {
  const alert = alerts.get(id);
  if (alert) {
    alert.acknowledged = true;
    alerts.set(id, alert);
    persistAlerts();
  }
}
