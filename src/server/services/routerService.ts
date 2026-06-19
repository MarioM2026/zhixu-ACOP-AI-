/**
 * 模型路由服务
 * 核心决策引擎：根据任务类型 + 策略选择最优模型
 */
import { v4 as uuidv4 } from 'uuid';
import {
  RoutingDecision, RoutingRule, RoutingStats, RoutingStrategy,
  ModelProfile, TaskType, ModelCandidate, ModelCapabilities,
} from '../../shared/types/index';
import { modelProfileService } from './modelProfileService';
import { taskClassifier } from './taskClassifier';
import { loadJSON, saveJSON } from './storageService';
import { logger } from './logger';

// 权重配置
const WEIGHTS = {
  cost_optimized: { cost: 0.6, speed: 0.2, capability: 0.2 },
  speed_optimized: { cost: 0.1, speed: 0.7, capability: 0.2 },
  quality_optimized: { cost: 0.1, speed: 0.1, capability: 0.8 },
  balanced: { cost: 0.3, speed: 0.3, capability: 0.4 },
  custom: { cost: 0.33, speed: 0.33, capability: 0.34 },
};

/** 全局限流/预算配置 */
interface BudgetConfig {
  dailyTokenBudget: number;     // 每日 Token 预算
  monthlyBudget: number;         // 月度预算（美元）
  warnAtPercent: number;         // 预算预警百分比
}

const ROUTING_RULES_KEY = 'routing-rules';
const ROUTING_STATS_KEY = 'routing-stats';
const ROUTING_CONFIG_KEY = 'routing-config';
const ROUTING_HISTORY_KEY = 'routing-history';

class RouterService {
  private rules: Map<string, RoutingRule> = new Map();
  private stats: RoutingStats = {
    totalDecisions: 0,
    modelUsage: {},
    taskTypeDistribution: {} as Record<TaskType, number>,
    avgLatencyByModel: {},
    avgCostByModel: {},
    strategyUsage: {} as Record<RoutingStrategy, number>,
  };
  private budgetConfig: BudgetConfig = {
    dailyTokenBudget: 10_000_000,
    monthlyBudget: 100,
    warnAtPercent: 80,
  };
  private recentTaskTypes: Map<string, TaskType[]> = new Map(); // sessionId -> 最近任务类型
  private history: RoutingDecision[] = [];
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    try {
      // 加载规则
      const savedRules = await loadJSON<RoutingRule[]>(ROUTING_RULES_KEY, []);
      for (const rule of savedRules) {
        this.rules.set(rule.id, rule);
      }

      // 加载统计
      const savedStats = await loadJSON<RoutingStats>(ROUTING_STATS_KEY, this.stats);
      if (savedStats) this.stats = savedStats;

      // 加载配置
      const savedConfig = await loadJSON<BudgetConfig>(ROUTING_CONFIG_KEY, this.budgetConfig);
      if (savedConfig) this.budgetConfig = savedConfig;

      // 加载历史（最近100条）
      const savedHistory = await loadJSON<RoutingDecision[]>(ROUTING_HISTORY_KEY, []);
      this.history = (savedHistory || []).slice(-100);

      // 初始化默认规则（如果没有任何规则）
      if (this.rules.size === 0) {
        await this.initDefaultRules();
      }

      // 初始化时持久化 stats 和 history（确保文件存在）
      await this.persistStats();
      await this.persistHistory();

      logger.info(`[Router] 初始化完成: ${this.rules.size} 条规则, ${this.stats.totalDecisions} 次历史决策`);
      this.initialized = true;
    } catch (e) {
      logger.warn('[Router] 初始化失败', e);
      await this.initDefaultRules();
      this.initialized = true;
    }
  }

  private async initDefaultRules() {
    const defaultRules: RoutingRule[] = [
      {
        id: 'rule-cost-sensitive',
        name: '成本敏感场景',
        description: '对 Token 消耗敏感的简单任务，优先使用低成本模型',
        enabled: true,
        conditions: { taskTypes: ['code_completion', 'explanation', 'general'] },
        strategy: 'cost_optimized',
        priority: 1,
      },
      {
        id: 'rule-quality-critical',
        name: '质量关键场景',
        description: '安全审查、Bug修复等高风险任务，优先保证质量',
        enabled: true,
        conditions: { taskTypes: ['bug_fix', 'security_review', 'debugging', 'architecture'] },
        strategy: 'quality_optimized',
        priority: 10,
      },
      {
        id: 'rule-speed-critical',
        name: '速度优先场景',
        description: '需要快速响应的交互式任务，优先选择低延迟模型',
        enabled: true,
        conditions: { taskTypes: ['code_completion', 'general'] },
        strategy: 'speed_optimized',
        priority: 5,
      },
    ];
    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
    await this.persistRules();
  }

  /**
   * 核心路由决策：给定输入文本和会话，返回最优模型
   */
  async route(input: string, sessionId: string, inputTokens: number): Promise<RoutingDecision> {
    await this.initialize();

    // 1. 任务类型识别
    const recentTypes = this.recentTaskTypes.get(sessionId) || [];
    const classification = taskClassifier.classify(input, { sessionId, recentTypes });

    // 2. 匹配路由规则
    const matchedRule = this.findMatchingRule(classification.taskType, sessionId);

    // 3. 获取候选模型并评分
    const candidates = this.scoreCandidates(classification.taskType, matchedRule?.strategy || 'balanced');

    // 4. 根据策略选择最优模型
    const selected = this.selectBest(candidates, matchedRule?.strategy || 'balanced');

    // 5. 构建决策结果
    const decision: RoutingDecision = {
      decisionId: uuidv4(),
      timestamp: Date.now(),
      input: {
        taskType: classification.taskType,
        sessionId,
        inputTokens,
        userIntent: input.slice(0, 100), // 保留前100字符用于调试
      },
      candidates,
      selected,
      strategy: matchedRule?.strategy || 'balanced',
    };

    // 6. 更新历史记录
    this.history.push(decision);
    if (this.history.length > 100) this.history.shift();

    // 7. 更新会话上下文
    recentTypes.push(classification.taskType);
    if (recentTypes.length > 5) recentTypes.shift();
    this.recentTaskTypes.set(sessionId, recentTypes);

    // 8. 更新统计（异步，不阻塞路由决策）
    this.updateStats(decision);

    logger.info(`[Router] 路由决策: ${classification.taskType} -> ${selected.modelId} (策略: ${decision.strategy}, 置信度: ${(selected.confidence * 100).toFixed(0)}%)`);

    return decision;
  }

  /** 为路由决策补充实际执行结果 */
  async recordOutcome(decisionId: string, actualLatency: number, actualTokens: number, actualQuality?: number) {
    const decision = this.history.find(d => d.decisionId === decisionId);
    if (decision) {
      decision.actualLatency = actualLatency;
      decision.actualTokens = actualTokens;
      decision.actualQuality = actualQuality;
      await this.persistHistory();
    }
  }

  /** 对候选模型进行综合评分 */
  private scoreCandidates(taskType: TaskType, strategy: RoutingStrategy): ModelCandidate[] {
    const profiles = modelProfileService.getEnabledProfiles();
    const weights = WEIGHTS[strategy] || WEIGHTS.balanced;
    const capabilityKey = taskType as keyof ModelCapabilities;

    const maxLatency = Math.max(...profiles.map(p => p.avgLatency));
    const maxCost = Math.max(...profiles.map(p => p.costPerMillionInput + p.costPerMillionOutput));

    return profiles.map(profile => {
      // 成本得分（越低越好，取反归一化）
      const totalCost = profile.costPerMillionInput + profile.costPerMillionOutput;
      const costScore = maxCost > 0 ? ((maxCost - totalCost) / maxCost) * 100 : 100;

      // 速度得分（延迟越低越好）
      const speedScore = maxLatency > 0 ? ((maxLatency - profile.avgLatency) / maxLatency) * 100 : 100;

      // 能力得分（该任务能力评分，归一化到0-100）
      const capability = profile.capabilities[capabilityKey] || 5;
      const capabilityScore = capability * 10; // 1-10 -> 10-100

      // 综合得分
      const totalScore = Math.round(
        costScore * weights.cost +
        speedScore * weights.speed +
        capabilityScore * weights.capability
      );

      // 生成理由
      const reasons: string[] = [];
      if (capability >= 9) reasons.push('任务能力强');
      if (costScore > 70) reasons.push('成本低');
      if (speedScore > 70) reasons.push('响应快');
      if (profile.tags.length > 0) reasons.push(profile.tags[0]);

      return {
        modelId: profile.modelId,
        totalScore,
        costScore: Math.round(costScore),
        speedScore: Math.round(speedScore),
        capabilityScore: Math.round(capabilityScore),
        reason: reasons.join(' · ') || '综合最优',
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  /** 根据策略选择最优模型 */
  private selectBest(candidates: ModelCandidate[], strategy: RoutingStrategy): { modelId: string; reason: string; confidence: number } {
    if (candidates.length === 0) {
      return { modelId: 'claude-sonnet-4-20250514', reason: '默认模型', confidence: 0.5 };
    }

    // 置信度 = 第一名得分 / 前两名得分差距
    const top = candidates[0];
    const second = candidates[1] || { totalScore: 0 };
    const confidence = second.totalScore > 0
      ? Math.min(0.95, top.totalScore / (top.totalScore + second.totalScore))
      : 0.8;

    const profile = modelProfileService.getProfile(top.modelId);

    let reason = `综合评分最高 (${top.totalScore}分)`;
    switch (strategy) {
      case 'cost_optimized': reason = `成本最优 ${top.costScore}分`; break;
      case 'speed_optimized': reason = `速度最快 ${top.speedScore}分`; break;
      case 'quality_optimized': reason = `能力最强 ${top.capabilityScore}分`; break;
    }

    if (profile) {
      reason += ` · ${profile.displayName}`;
    }

    return {
      modelId: top.modelId,
      reason,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /** 查找匹配的路由规则 */
  private findMatchingRule(taskType: TaskType, sessionId: string): RoutingRule | undefined {
    const enabledRules = Array.from(this.rules.values())
      .filter(r => r.enabled && r.conditions.taskTypes.includes(taskType))
      .sort((a, b) => b.priority - a.priority);

    return enabledRules[0];
  }

  /** 更新统计信息 */
  private updateStats(decision: RoutingDecision) {
    this.stats.totalDecisions++;

    // 模型使用统计
    this.stats.modelUsage[decision.selected.modelId] =
      (this.stats.modelUsage[decision.selected.modelId] || 0) + 1;

    // 任务类型分布
    this.stats.taskTypeDistribution[decision.input.taskType] =
      (this.stats.taskTypeDistribution[decision.input.taskType] || 0) + 1;

    // 策略使用统计
    this.stats.strategyUsage[decision.strategy] =
      (this.stats.strategyUsage[decision.strategy] || 0) + 1;

    // 实际延迟回填（如果有）
    if (decision.actualLatency !== undefined) {
      const prevLatency = this.stats.avgLatencyByModel[decision.selected.modelId] || 0;
      const prevCount = this.stats.modelUsage[decision.selected.modelId] || 1;
      this.stats.avgLatencyByModel[decision.selected.modelId] =
        Math.round((prevLatency * (prevCount - 1) + decision.actualLatency) / prevCount);
    }

    // 异步持久化
    this.persistStats().catch(() => {});
    this.persistHistory().catch(() => {});
  }

  // =============================================
  // 规则管理
  // =============================================

  getAllRules(): RoutingRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  getRule(id: string): RoutingRule | undefined {
    return this.rules.get(id);
  }

  async createRule(rule: Omit<RoutingRule, 'id'>): Promise<RoutingRule> {
    const newRule: RoutingRule = { ...rule, id: `rule-${uuidv4()}` };
    this.rules.set(newRule.id, newRule);
    await this.persistRules();
    logger.info(`[Router] 新增路由规则: ${newRule.name}`);
    return newRule;
  }

  async updateRule(id: string, updates: Partial<RoutingRule>): Promise<boolean> {
    const existing = this.rules.get(id);
    if (!existing) return false;
    const updated = { ...existing, ...updates, id };
    this.rules.set(id, updated);
    await this.persistRules();
    return true;
  }

  async deleteRule(id: string): Promise<boolean> {
    if (!this.rules.has(id)) return false;
    this.rules.delete(id);
    await this.persistRules();
    return true;
  }

  // =============================================
  // 配置管理
  // =============================================

  getBudgetConfig(): BudgetConfig {
    return { ...this.budgetConfig };
  }

  async updateBudgetConfig(config: Partial<BudgetConfig>) {
    this.budgetConfig = { ...this.budgetConfig, ...config };
    await saveJSON(ROUTING_CONFIG_KEY, this.budgetConfig);
  }

  getStats(): RoutingStats {
    return { ...this.stats };
  }

  getHistory(limit = 20): RoutingDecision[] {
    return this.history.slice(-limit);
  }

  /** 模拟路由（不记录统计，用于预览） */
  simulate(input: string, strategy?: RoutingStrategy): {
    taskType: TaskType;
    taskTypeName: string;
    confidence: number;
    candidates: ModelCandidate[];
    topPick: ModelCandidate;
  } {
    const classification = taskClassifier.classify(input);
    const candidates = this.scoreCandidates(classification.taskType, strategy || 'balanced');
    const topPick = candidates[0] || { modelId: 'unknown', totalScore: 0, reason: '无可用模型' };

    return {
      taskType: classification.taskType,
      taskTypeName: taskClassifier.getTaskTypeName(classification.taskType),
      confidence: classification.confidence,
      candidates: candidates.slice(0, 5),
      topPick,
    };
  }

  // =============================================
  // 持久化
  // =============================================

  private async persistRules() {
    await saveJSON(ROUTING_RULES_KEY, Array.from(this.rules.values()));
  }

  private async persistStats() {
    await saveJSON(ROUTING_STATS_KEY, this.stats);
  }

  private async persistHistory() {
    await saveJSON(ROUTING_HISTORY_KEY, this.history);
  }
}

export const routerService = new RouterService();
