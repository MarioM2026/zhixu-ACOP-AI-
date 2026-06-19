import type { AICodeEvent, ToolType } from '@zhixu/shared/types';
import { logger } from './logger';
import { recordAICodeEvent } from './aiCodeEventService';

export interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: number;
  latency?: number;
  error?: string;
}

export interface AdapterMetrics {
  totalEvents: number;
  totalTokens: number;
  avgLatency: number;
  errorCount: number;
}

export interface AdapterConfig {
  name: string;
  version: string;
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
}

export interface AgentAdapter {
  readonly config: AdapterConfig;
  readonly toolType: ToolType;
  initialize(): Promise<void>;
  dataCollect(): Promise<AICodeEvent[]>;
  healthCheck(): Promise<AdapterHealth>;
  getMetrics(): Promise<AdapterMetrics>;
  shutdown(): Promise<void>;
  setMode?(mode: 'manual' | 'auto'): void;
  setLogPath?(path: string): void;
  setEnabled?(enabled: boolean): void;
  getDetectedPath?(): string | null;
  submitManualEvent?(event: Partial<AICodeEvent> & { sessionId: string; modelId: string; tokenConsumption: { input: number; output: number; total?: number } }): AICodeEvent;
}

interface AdapterRuntime {
  adapter: AgentAdapter;
  lastCollectTime: number;
  totalCollected: number;
  lastError?: string;
  lastEvents?: AICodeEvent[];
}

class AdapterService {
  private registry: Map<ToolType, AdapterRuntime> = new Map();
  private isRunning: boolean = false;
  private collectTimer: ReturnType<typeof setInterval> | null = null;

  register(adapter: AgentAdapter): void {
    if (this.registry.has(adapter.toolType)) {
      logger.warn(`Adapter for ${adapter.toolType} already registered, overwriting`);
    }
    this.registry.set(adapter.toolType, {
      adapter,
      lastCollectTime: 0,
      totalCollected: 0,
    });
    logger.info(`Adapter registered: ${adapter.toolType}`, { name: adapter.config.name });
  }

  unregister(toolType: ToolType): void {
    const runtime = this.registry.get(toolType);
    if (runtime) {
      runtime.adapter.shutdown().catch((e) =>
        logger.error(`Failed to shutdown adapter ${toolType}`, { error: String(e) }),
      );
    }
    this.registry.delete(toolType);
    logger.info(`Adapter unregistered: ${toolType}`);
  }

  getAdapter(toolType: ToolType): AgentAdapter | null {
    const runtime = this.registry.get(toolType);
    return runtime ? runtime.adapter : null;
  }

  getAllToolTypes(): ToolType[] {
    return Array.from(this.registry.keys());
  }

  async initializeAll(): Promise<void> {
    logger.info(`Initializing ${this.registry.size} adapters...`);
    for (const [toolType, runtime] of this.registry.entries()) {
      try {
        await runtime.adapter.initialize();
        logger.info(`Adapter initialized: ${toolType}`);
      } catch (error) {
        logger.error(`Failed to initialize adapter ${toolType}`, { error: String(error) });
        runtime.lastError = error instanceof Error ? error.message : String(error);
      }
    }
    logger.info('All adapters initialized');
  }

  async collectAndRecord(): Promise<{ toolType: ToolType; count: number; error?: string }[]> {
    const results: { toolType: ToolType; count: number; error?: string }[] = [];

    for (const [toolType, runtime] of this.registry.entries()) {
      if (!runtime.adapter.config.enabled) continue;
      try {
        const events = await runtime.adapter.dataCollect();
        for (const evt of events) {
          await recordAICodeEvent(evt);
        }
        runtime.lastCollectTime = Date.now();
        runtime.totalCollected += events.length;
        runtime.lastEvents = events.slice(-5);
        results.push({ toolType, count: events.length });
        if (events.length > 0) {
          logger.info(`Collected ${events.length} events from ${toolType}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        runtime.lastError = msg;
        logger.error(`Failed to collect events from ${toolType}`, { error: msg });
        results.push({ toolType, count: 0, error: msg });
      }
    }
    return results;
  }

  startScheduledCollection(intervalMs: number = 15000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(`Starting scheduled adapter collection (interval: ${intervalMs}ms)`);
    this.collectAndRecord().catch((e) => logger.error('Initial collect failed', { error: String(e) }));
    this.collectTimer = setInterval(() => {
      this.collectAndRecord().catch((e) =>
        logger.error('Scheduled collect failed', { error: String(e) }),
      );
    }, intervalMs);
  }

  stopScheduledCollection(): void {
    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = null;
    }
    this.isRunning = false;
    logger.info('Scheduled adapter collection stopped');
  }

  async getStatus(): Promise<Array<{
    toolType: ToolType;
    name: string;
    version: string;
    enabled: boolean;
    mode: string;
    logPath: string | null;
    detectedPath: string | null;
    lastCollectTime: number;
    totalCollected: number;
    lastError?: string;
    health: AdapterHealth;
    metrics: AdapterMetrics;
  }>> {
    const result: Array<{
      toolType: ToolType; name: string; version: string; enabled: boolean; mode: string;
      logPath: string | null; detectedPath: string | null; lastCollectTime: number;
      totalCollected: number; lastError?: string; health: AdapterHealth; metrics: AdapterMetrics;
    }> = [];

    for (const [toolType, runtime] of this.registry.entries()) {
      try {
        const adapter = runtime.adapter;
        const health = await adapter.healthCheck();
        const metrics = await adapter.getMetrics();
        const anyCfg = adapter.config as any;
        result.push({
          toolType,
          name: adapter.config.name,
          version: adapter.config.version,
          enabled: adapter.config.enabled,
          mode: anyCfg.mode || 'manual',
          logPath: anyCfg.logPath || null,
          detectedPath: typeof adapter.getDetectedPath === 'function' ? adapter.getDetectedPath() : null,
          lastCollectTime: runtime.lastCollectTime,
          totalCollected: runtime.totalCollected,
          lastError: runtime.lastError,
          health,
          metrics,
        });
      } catch (error) {
        logger.error(`Failed to get status for adapter ${toolType}`, { error: String(error) });
      }
    }
    return result;
  }

  async configureAdapter(toolType: ToolType, cfg: { mode?: 'manual' | 'auto'; logPath?: string; enabled?: boolean }): Promise<boolean> {
    const runtime = this.registry.get(toolType);
    if (!runtime) return false;
    const adapter = runtime.adapter;
    if (cfg.mode !== undefined && adapter.setMode) adapter.setMode(cfg.mode);
    if (cfg.logPath !== undefined && adapter.setLogPath) adapter.setLogPath(cfg.logPath);
    if (cfg.enabled !== undefined && adapter.setEnabled) adapter.setEnabled(cfg.enabled);
    logger.info(`Adapter ${toolType} configured`, cfg);
    return true;
  }

  async shutdownAll(): Promise<void> {
    this.stopScheduledCollection();
    for (const [toolType, runtime] of this.registry.entries()) {
      try {
        await runtime.adapter.shutdown();
        logger.info(`Adapter shutdown: ${toolType}`);
      } catch (error) {
        logger.error(`Failed to shutdown adapter ${toolType}`, { error: String(error) });
      }
    }
    this.registry.clear();
  }
}

export const adapterService = new AdapterService();
