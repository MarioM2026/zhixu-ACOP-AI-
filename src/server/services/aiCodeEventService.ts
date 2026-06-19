import { v4 as uuidv4 } from 'uuid';
import type { AICodeEvent, ApiResponse } from '@zhixu/shared/types';
import { logger } from './logger';
import { loadJSON, schedulePersist } from './storageService';

const STORAGE_KEY = 'ai-code-events';

const events: Map<string, AICodeEvent> = new Map();

function getSampleEvents(): AICodeEvent[] {
  const now = Date.now();
  const sessionId = 'seed-session-' + Math.floor(Math.random() * 1000);
  const tools: Array<'trae' | 'claude_code' | 'cursor' | 'github_copilot'> = ['trae', 'claude_code', 'cursor', 'github_copilot'];
  const models = ['claude-sonnet-4', 'gpt-4-turbo', 'deepseek-v3'];

  return Array.from({ length: 15 }, (_, i) => {
    const hasError = Math.random() < 0.2;
    const tool = tools[Math.floor(Math.random() * tools.length)];
    const inputTokens = Math.floor(Math.random() * 3000) + 500;
    const outputTokens = Math.floor(Math.random() * 2000) + 300;
    const eventId = 'seed-event-' + i + '-' + Math.floor(Math.random() * 1000000);
    return {
      id: eventId,
      traceId: 'trace-seed-' + i + '-' + Math.floor(Math.random() * 10000),
      sessionId,
      tool,
      modelId: models[Math.floor(Math.random() * models.length)],
      timestamp: now - (15 - i) * 60 * 1000 * Math.floor(Math.random() * 5 + 1),
      tokenConsumption: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      performance: {
        latency: Math.floor(Math.random() * 8000) + 500,
        ttft: Math.floor(Math.random() * 3000) + 200,
      },
      quality: hasError
        ? {
            errorType: ['timeout', 'invalid_response', 'context_overflow'][Math.floor(Math.random() * 3)],
            errorMessage: '请求超时或响应格式异常',
            codeAcceptance: false,
          }
        : {
            codeAcceptance: true,
          },
      metadata: {
        version: '1.0.0',
        environment: 'development',
      },
    };
  });
}

export async function loadFromStorage(): Promise<void> {
  const saved = await loadJSON<AICodeEvent[]>(STORAGE_KEY, []);
  if (saved.length > 0) {
    saved.forEach((event) => events.set(event.id || uuidv4(), event));
    logger.info(`[Events] 从持久化加载 ${saved.length} 条事件`);
  } else {
    const sample = getSampleEvents();
    sample.forEach((event) => events.set(event.id || uuidv4(), event));
    logger.info(`[Events] 首次启动，注入 ${sample.length} 条示例事件`);
    schedulePersist(STORAGE_KEY, () => Array.from(events.values()));
  }
}

function persist(): void {
  schedulePersist(STORAGE_KEY, () => Array.from(events.values()));
}

// 记录 AI 代码事件
export async function recordAICodeEvent(event: AICodeEvent): Promise<AICodeEvent> {
  const id = event.id || uuidv4();
  const newEvent: AICodeEvent = {
    ...event,
    id,
    traceId: event.traceId || uuidv4(),
    timestamp: event.timestamp || Date.now(),
  };

  events.set(id, newEvent);
  logger.info(`Recorded AI code event: ${id}`, { tool: event.tool, sessionId: event.sessionId });
  persist();

  return newEvent;
}

// 获取事件列表（带分页）
export async function getEvents(params: {
  page: number;
  pageSize: number;
  tool?: string;
  startTime?: number;
  endTime?: number;
}): Promise<{ data: AICodeEvent[]; pagination: { page: number; pageSize: number; total: number } }> {
  let filteredEvents = Array.from(events.values());

  // 按工具类型过滤
  if (params.tool) {
    filteredEvents = filteredEvents.filter((e) => e.tool === params.tool);
  }

  // 按时间范围过滤
  if (params.startTime) {
    filteredEvents = filteredEvents.filter((e) => e.timestamp >= params.startTime!);
  }
  if (params.endTime) {
    filteredEvents = filteredEvents.filter((e) => e.timestamp <= params.endTime!);
  }

  // 按时间倒序
  filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

  // 分页
  const total = filteredEvents.length;
  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize;
  const paginatedEvents = filteredEvents.slice(start, end);

  return {
    data: paginatedEvents,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
    },
  };
}

// 获取单个事件
export async function getEventById(id: string): Promise<AICodeEvent | null> {
  return events.get(id) || null;
}

// 获取事件统计
export async function getEventStats(): Promise<{
  total: number;
  byTool: Record<string, number>;
}> {
  const allEvents = Array.from(events.values());
  const byTool: Record<string, number> = {};

  for (const event of allEvents) {
    byTool[event.tool] = (byTool[event.tool] || 0) + 1;
  }

  return {
    total: allEvents.length,
    byTool,
  };
}

// 获取最近的事件（用于规则引擎评估）
export async function getRecentEvents(limit: number = 100): Promise<AICodeEvent[]> {
  const allEvents = Array.from(events.values());
  return allEvents
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}
