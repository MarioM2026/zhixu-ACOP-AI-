import { v4 as uuidv4 } from 'uuid';
import type { AICodeEvent, ToolType } from '@zhixu/shared/types';
import type { AdapterConfig, AdapterHealth, AdapterMetrics, AgentAdapter } from '../adapterService';
import { logger } from '../logger';
import { findExistingDir, scanDirectoryForEvents } from './adapterUtils';

export interface TraeAdapterConfig extends AdapterConfig {
  mode?: 'manual' | 'auto';
  logPath?: string;
  extraLogPaths?: string[];
}

const DEFAULT_MODEL = 'qwen-plus';

export class TraeAdapter implements AgentAdapter {
  readonly toolType: ToolType = 'trae';
  config: TraeAdapterConfig & { mode: 'manual' | 'auto' };

  private metrics: AdapterMetrics = { totalEvents: 0, totalTokens: 0, avgLatency: 0, errorCount: 0 };
  private running: boolean = false;
  private pendingEvents: AICodeEvent[] = [];
  private processedFileMap: Record<string, number> = {};
  private lastDetectedPath: string | null = null;

  constructor(config: TraeAdapterConfig) {
    this.config = {
      ...config,
      name: config.name || 'Trae 适配器',
      version: config.version || '1.2.0',
      enabled: config.enabled !== undefined ? config.enabled : true,
      mode: config.mode || 'auto',
    };
  }

  setMode(mode: 'manual' | 'auto'): void {
    this.config.mode = mode;
    logger.info(`[TraeAdapter] 模式切换为 ${mode}`);
  }

  setLogPath(path: string): void {
    this.config.logPath = path;
    logger.info(`[TraeAdapter] 日志路径已更新`, { path });
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  getDetectedPath(): string | null {
    return this.lastDetectedPath;
  }

  async initialize(): Promise<void> {
    logger.info('[TraeAdapter] 初始化中', { mode: this.config.mode });
    this.running = true;
    if (this.config.mode === 'auto') {
      this.lastDetectedPath = this.resolveLogPath();
      logger.info('[TraeAdapter] 自动模式已启用', { logPath: this.lastDetectedPath || '未检测到' });
    }
  }

  async dataCollect(): Promise<AICodeEvent[]> {
    if (!this.running) return [];
    try {
      let events: AICodeEvent[] = [];

      if (this.config.mode === 'auto') {
        const dir = this.resolveLogPath();
        if (dir) {
          this.lastDetectedPath = dir;
          const scanned = scanDirectoryForEvents(dir, 'trae', DEFAULT_MODEL, this.processedFileMap, 30);
          if (scanned.length > 0) {
            logger.info(`[TraeAdapter] 从日志扫描到 ${scanned.length} 个事件`, { dir });
          }
          events = scanned;
        }
      }

      if (this.pendingEvents.length > 0) {
        events = [...events, ...this.pendingEvents];
        this.pendingEvents = [];
      }

      events.forEach((e) => this.updateMetrics(e));
      return events;
    } catch (error) {
      logger.error('[TraeAdapter] 采集失败', { error: String(error) });
      return [];
    }
  }

  submitManualEvent(partialEvent: Partial<AICodeEvent> & {
    sessionId: string;
    modelId: string;
    tokenConsumption: { input: number; output: number; total?: number };
  }): AICodeEvent {
    const fullEvent: AICodeEvent = {
      id: uuidv4(),
      sessionId: partialEvent.sessionId,
      traceId: partialEvent.traceId || uuidv4(),
      timestamp: partialEvent.timestamp || Date.now(),
      tool: 'trae',
      modelId: partialEvent.modelId || DEFAULT_MODEL,
      tokenConsumption: {
        input: partialEvent.tokenConsumption.input,
        output: partialEvent.tokenConsumption.output,
        total: partialEvent.tokenConsumption.total ||
          partialEvent.tokenConsumption.input + partialEvent.tokenConsumption.output,
      },
      performance: partialEvent.performance || { latency: 2000, ttft: 500 },
      quality: partialEvent.quality,
    };
    this.pendingEvents.push(fullEvent);
    return fullEvent;
  }

  async healthCheck(): Promise<AdapterHealth> {
    const start = Date.now();
    try {
      const logDir = this.resolveLogPath();
      return {
        status: this.running ? 'healthy' : 'degraded',
        lastCheck: start,
        latency: Date.now() - start,
        error: this.config.mode === 'auto' && !logDir ? '未检测到可用日志目录' : undefined,
      };
    } catch (error) {
      return { status: 'unhealthy', lastCheck: Date.now(), error: String(error) };
    }
  }

  async getMetrics(): Promise<AdapterMetrics> {
    return { ...this.metrics };
  }

  async shutdown(): Promise<void> {
    this.running = false;
    this.pendingEvents = [];
    logger.info('[TraeAdapter] 已停止');
  }

  private updateMetrics(e: AICodeEvent): void {
    this.metrics.totalEvents++;
    this.metrics.totalTokens += e.tokenConsumption.total;
    if (e.performance?.latency) {
      this.metrics.avgLatency =
        (this.metrics.avgLatency * (this.metrics.totalEvents - 1) + e.performance.latency) /
        this.metrics.totalEvents;
    }
    if (e.quality?.errorType) this.metrics.errorCount++;
  }

  private resolveLogPath(): string | null {
    if (this.config.logPath) return this.config.logPath;

    const candidates: string[] = [];
    if (process.platform === 'win32') {
      candidates.push('%APPDATA%/Trae/User/trae');
      candidates.push('%APPDATA%/Trae/trae');
      candidates.push('%USERPROFILE%/.trae');
      candidates.push('%APPDATA%/Code/User/globalStorage/trae.trae');
      candidates.push('%APPDATA%/Code/User/globalStorage/alibabapublic.tongyi-lingma');
      candidates.push('%LOCALAPPDATA%/Trae');
    } else if (process.platform === 'darwin') {
      candidates.push('~/Library/Application Support/Trae');
      candidates.push('~/.trae');
      candidates.push('~/Library/Application Support/Code/User/globalStorage/trae.trae');
    } else {
      candidates.push('~/.config/Trae');
      candidates.push('~/.trae');
      candidates.push('~/.config/Code/User/globalStorage/trae.trae');
    }

    if (this.config.extraLogPaths) {
      candidates.unshift(...this.config.extraLogPaths);
    }

    return findExistingDir(candidates);
  }
}

export { TraeAdapter as default };
