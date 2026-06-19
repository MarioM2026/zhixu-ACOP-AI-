/**
 * 模型画像服务
 * 维护已知模型的详细能力画像，提供基准数据
 */
import { ModelProfile, ModelCapabilities } from '../../shared/types/index';
import { loadJSON, saveJSON } from './storageService';
import { logger } from './logger';

const STORAGE_KEY = 'model-profiles';

const DEFAULT_PROFILES: ModelProfile[] = [
  // Anthropic 系列
  {
    modelId: 'claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    costPerMillionInput: 3,
    costPerMillionOutput: 15,
    avgLatency: 2500,
    ttft: 400,
    maxTokens: 8192,
    contextWindow: 200000,
    enabled: true,
    tags: ['代码专家', '中成本', '快速响应'],
    capabilities: {
      codeCompletion: 9.5, codeReview: 9.8, bugFix: 9.7, refactoring: 9.6,
      codeGeneration: 9.4, explanation: 9.5, documentation: 8.5, testing: 9.2,
      debugging: 9.6, securityReview: 9.3, architecture: 9.0,
    },
  },
  {
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    costPerMillionInput: 3,
    costPerMillionOutput: 15,
    avgLatency: 3000,
    ttft: 500,
    maxTokens: 8192,
    contextWindow: 200000,
    enabled: true,
    tags: ['代码专家', '中成本'],
    capabilities: {
      codeCompletion: 9.3, codeReview: 9.6, bugFix: 9.5, refactoring: 9.4,
      codeGeneration: 9.2, explanation: 9.3, documentation: 8.3, testing: 9.0,
      debugging: 9.4, securityReview: 9.1, architecture: 8.8,
    },
  },
  {
    modelId: 'claude-3-opus',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    costPerMillionInput: 15,
    costPerMillionOutput: 75,
    avgLatency: 4500,
    ttft: 700,
    maxTokens: 4096,
    contextWindow: 200000,
    enabled: false,
    tags: ['高质量', '高成本', '复杂任务'],
    capabilities: {
      codeCompletion: 9.2, codeReview: 9.8, bugFix: 9.7, refactoring: 9.6,
      codeGeneration: 9.3, explanation: 9.7, documentation: 9.0, testing: 9.3,
      debugging: 9.6, securityReview: 9.7, architecture: 9.8,
    },
  },
  // OpenAI 系列
  {
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    costPerMillionInput: 2.5,
    costPerMillionOutput: 10,
    avgLatency: 2000,
    ttft: 300,
    maxTokens: 16384,
    contextWindow: 128000,
    enabled: true,
    tags: ['多模态', '性价比', '快速'],
    capabilities: {
      codeCompletion: 9.0, codeReview: 9.2, bugFix: 9.0, refactoring: 9.1,
      codeGeneration: 9.3, explanation: 9.0, documentation: 8.8, testing: 8.9,
      debugging: 8.8, securityReview: 8.5, architecture: 8.7,
    },
  },
  {
    modelId: 'gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    provider: 'openai',
    costPerMillionInput: 10,
    costPerMillionOutput: 30,
    avgLatency: 3000,
    ttft: 450,
    maxTokens: 4096,
    contextWindow: 128000,
    enabled: false,
    tags: ['高性能', '高成本'],
    capabilities: {
      codeCompletion: 9.2, codeReview: 9.4, bugFix: 9.2, refactoring: 9.3,
      codeGeneration: 9.4, explanation: 9.1, documentation: 9.0, testing: 9.1,
      debugging: 9.1, securityReview: 8.8, architecture: 9.0,
    },
  },
  // DeepSeek 系列
  {
    modelId: 'deepseek-v3',
    displayName: 'DeepSeek V3',
    provider: 'deepseek',
    costPerMillionInput: 0.27,
    costPerMillionOutput: 1.1,
    avgLatency: 3500,
    ttft: 600,
    maxTokens: 8192,
    contextWindow: 64000,
    enabled: true,
    tags: ['超低价', '性价比之王', '中文优化'],
    capabilities: {
      codeCompletion: 8.5, codeReview: 8.3, bugFix: 8.4, refactoring: 8.5,
      codeGeneration: 8.7, explanation: 8.0, documentation: 7.5, testing: 8.0,
      debugging: 8.2, securityReview: 7.0, architecture: 7.5,
    },
  },
  {
    modelId: 'deepseek-coder-33b',
    displayName: 'DeepSeek Coder 33B',
    provider: 'deepseek',
    costPerMillionInput: 0.27,
    costPerMillionOutput: 1.1,
    avgLatency: 5000,
    ttft: 800,
    maxTokens: 4096,
    contextWindow: 16000,
    enabled: true,
    tags: ['代码专用', '超低价'],
    capabilities: {
      codeCompletion: 9.0, codeReview: 8.5, bugFix: 8.8, refactoring: 8.9,
      codeGeneration: 9.2, explanation: 7.5, documentation: 7.0, testing: 8.5,
      debugging: 8.6, securityReview: 7.5, architecture: 7.0,
    },
  },
  // 通义千问系列
  {
    modelId: 'qwen-plus',
    displayName: '通义千问 Plus',
    provider: 'qwen',
    costPerMillionInput: 0.6,
    costPerMillionOutput: 1.8,
    avgLatency: 2800,
    ttft: 450,
    maxTokens: 8192,
    contextWindow: 131072,
    enabled: true,
    tags: ['中文优化', '中成本', '高性价比'],
    capabilities: {
      codeCompletion: 8.7, codeReview: 8.5, bugFix: 8.5, refactoring: 8.6,
      codeGeneration: 8.8, explanation: 8.5, documentation: 8.0, testing: 8.2,
      debugging: 8.3, securityReview: 7.5, architecture: 8.0,
    },
  },
  {
    modelId: 'qwen-coder-32b',
    displayName: '通义千问 Coder 32B',
    provider: 'qwen',
    costPerMillionInput: 0.6,
    costPerMillionOutput: 1.8,
    avgLatency: 4000,
    ttft: 650,
    maxTokens: 4096,
    contextWindow: 32768,
    enabled: true,
    tags: ['代码专用', '中文友好'],
    capabilities: {
      codeCompletion: 9.0, codeReview: 8.5, bugFix: 8.8, refactoring: 8.9,
      codeGeneration: 9.1, explanation: 8.0, documentation: 7.5, testing: 8.6,
      debugging: 8.6, securityReview: 7.5, architecture: 7.5,
    },
  },
  // Gemini
  {
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    costPerMillionInput: 1.25,
    costPerMillionOutput: 5,
    avgLatency: 3000,
    ttft: 500,
    maxTokens: 8192,
    contextWindow: 1000000,
    enabled: false,
    tags: ['超长上下文', '多模态', '中成本'],
    capabilities: {
      codeCompletion: 8.8, codeReview: 8.9, bugFix: 8.7, refactoring: 8.8,
      codeGeneration: 9.0, explanation: 8.8, documentation: 8.5, testing: 8.5,
      debugging: 8.5, securityReview: 8.2, architecture: 8.5,
    },
  },
];

class ModelProfileService {
  private profiles: Map<string, ModelProfile> = new Map();
  private initialized = false;

  async initialize() {
    console.log('[ModelProfile] 开始初始化...');
    if (this.initialized) {
      console.log('[ModelProfile] 已初始化，跳过');
      return;
    }
    try {
      const saved = await loadJSON<ModelProfile[]>(STORAGE_KEY, []);
      if (saved && saved.length > 0) {
        // 合并：使用保存的 + 补充默认的
        const savedMap = new Map(saved.map(p => [p.modelId, p]));
        for (const defaultP of DEFAULT_PROFILES) {
          if (!savedMap.has(defaultP.modelId)) {
            savedMap.set(defaultP.modelId, defaultP);
          }
        }
        savedMap.forEach((p, id) => this.profiles.set(id, p));
      } else {
        // 使用默认数据
        for (const p of DEFAULT_PROFILES) {
          this.profiles.set(p.modelId, p);
        }
        await this.persist();
      }
      logger.info(`[ModelProfile] 加载 ${this.profiles.size} 个模型画像`);
      this.initialized = true;
    } catch (e) {
      logger.warn('[ModelProfile] 初始化失败，使用默认数据', e);
      for (const p of DEFAULT_PROFILES) {
        this.profiles.set(p.modelId, p);
      }
      this.initialized = true;
    }
  }

  private async persist() {
    const profiles = Array.from(this.profiles.values());
    await saveJSON(STORAGE_KEY, profiles);
  }

  /** 获取所有启用的模型画像 */
  getEnabledProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.enabled);
  }

  /** 获取所有模型画像（含禁用的） */
  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  /** 根据 modelId 获取单个模型画像 */
  getProfile(modelId: string): ModelProfile | undefined {
    return this.profiles.get(modelId);
  }

  /** 更新模型画像 */
  async updateProfile(modelId: string, updates: Partial<ModelProfile>): Promise<boolean> {
    const existing = this.profiles.get(modelId);
    if (!existing) return false;
    const updated = { ...existing, ...updates, modelId };
    this.profiles.set(modelId, updated);
    await this.persist();
    logger.info(`[ModelProfile] 更新模型画像: ${modelId}`);
    return true;
  }

  /** 添加自定义模型 */
  async addProfile(profile: ModelProfile): Promise<boolean> {
    if (this.profiles.has(profile.modelId)) return false;
    this.profiles.set(profile.modelId, profile);
    await this.persist();
    logger.info(`[ModelProfile] 新增模型: ${profile.modelId}`);
    return true;
  }

  /** 删除自定义模型（内置模型只能禁用，不能删除） */
  async deleteProfile(modelId: string): Promise<boolean> {
    const p = this.profiles.get(modelId);
    if (!p) return false;
    if (p.provider !== 'custom') return false; // 内置模型禁止删除
    this.profiles.delete(modelId);
    await this.persist();
    return true;
  }

  /** 获取最低成本模型 */
  getCheapestProfile(taskType?: string): ModelProfile | undefined {
    const enabled = this.getEnabledProfiles();
    if (enabled.length === 0) return undefined;
    return enabled.reduce((min, p) =>
      (p.costPerMillionInput + p.costPerMillionOutput) <
        (min.costPerMillionInput + min.costPerMillionOutput) ? p : min
    );
  }

  /** 获取最快模型 */
  getFastestProfile(): ModelProfile | undefined {
    const enabled = this.getEnabledProfiles();
    if (enabled.length === 0) return undefined;
    return enabled.reduce((min, p) => p.avgLatency < min.avgLatency ? p : min);
  }

  /** 获取特定任务能力最强的模型 */
  getBestForTask(taskType: string): ModelProfile | undefined {
    const enabled = this.getEnabledProfiles();
    if (enabled.length === 0) return undefined;
    const capabilityKey = taskType as keyof ModelCapabilities;
    return enabled.reduce((best, p) => {
      const cap = p.capabilities[capabilityKey] || 0;
      const bestCap = best.capabilities[capabilityKey] || 0;
      return cap > bestCap ? p : best;
    });
  }
}

export const modelProfileService = new ModelProfileService();
