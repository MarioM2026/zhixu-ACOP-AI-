import { v4 as uuidv4 } from 'uuid';
import type { AICodeEvent, ToolType } from '@zhixu/shared/types';
import type { AdapterConfig, AdapterHealth, AdapterMetrics, AgentAdapter } from '../adapterService';
import { logger } from '../logger';
import { findExistingDir, scanDirectoryForEvents } from './adapterUtils';

export interface ClaudeCodeAdapterConfig extends AdapterConfig {
  mode?: 'manual' | 'auto';
  logPath?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4';

export class ClaudeCodeAdapter implements AgentAdapter {
  readonly toolType: ToolType = 'claude_code';
  config: ClaudeCodeAdapterConfig & { mode: 'manual' | 'auto' };

  private metrics: AdapterMetrics = { totalEvents: 0, totalTokens: 0, avgLatency: 0, errorCount: 0 };
  private running: boolean = false;
  private pendingEvents: AICodeEvent[] = [];
  private processedFileMap: Record<string, number> = {};
  private lastDetectedPath: string | null = null;

  constructor(config: ClaudeCodeAdapterConfig) {
    this.config = {
      ...config,
      name: config.name || 'Claude Code 适配器',
      version: config.version || '1.2.0',
      enabled: config.enabled !== undefined ? config.enabled : true,
      mode: config.mode || 'auto',
    };
  }

  setMode(mode: 'manual' | 'auto'): void {
    this.config.mode = mode;
  }

  setLogPath(path: string): void {
    this.config.logPath = path;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  getDetectedPath(): string | null {
    return this.lastDetectedPath;
  }

  async initialize(): Promise<void> {
    logger.info('[ClaudeCodeAdapter] 初始化中', { mode: this.config.mode });
    this.running = true;
    if (this.config.mode === 'auto') {
      this.lastDetectedPath = this.resolveLogPath();
      logger.info('[ClaudeCodeAdapter] 自动模式已启用', { logPath: this.lastDetectedPath || '未检测到' });
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
          const scanned = scanDirectoryForEvents(
            dir,
            'claude_code',
            DEFAULT_MODEL,
            this.processedFileMap,
            30,
          );
          if (scanned.length > 0) {
            logger.info(`[ClaudeCodeAdapter] 从日志扫描到 ${scanned.length} 个事件`, { dir });
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
      logger.error('[ClaudeCodeAdapter] 采集失败', { error: String(error) });
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
      tool: 'claude_code',
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
    logger.info('[ClaudeCodeAdapter] 已停止');
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
      candidates.push('%USERPROFILE%/.claude/code');
      candidates.push('%USERPROFILE%/.claude/logs');
      candidates.push('%APPDATA%/ClaudeCode/logs');
      candidates.push('%APPDATA%/ClaudeCode');
      candidates.push('%LOCALAPPDATA%/ClaudeCode/logs');
    } else if (process.platform === 'darwin') {
      candidates.push('~/.claude/code');
      candidates.push('~/.claude/logs');
      candidates.push('~/Library/Application Support/ClaudeCode/logs');
    } else {
      candidates.push('~/.claude/code');
      candidates.push('~/.claude/logs');
      candidates.push('~/.config/claude-code');
    }

    return findExistingDir(candidates);
  }
}

export { ClaudeCodeAdapter as default };
