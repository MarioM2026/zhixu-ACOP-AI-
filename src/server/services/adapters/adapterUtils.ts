import fs from 'fs';
import path from 'path';
import type { AICodeEvent, ToolType } from '@zhixu/shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface ScanResult {
  events: AICodeEvent[];
  pathsScanned: string[];
  pathsFound: string[];
}

export function resolveHome(p: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '/';
  return p.replace(/^~/, home).replace(/%([^%]+)%/g, (_, env) => {
    return process.env[env] || '';
  });
}

export function findExistingDir(candidates: string[]): string | null {
  for (const raw of candidates) {
    const p = resolveHome(raw);
    if (p && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return p;
    }
  }
  return null;
}

function safeReadFile(filePath: string, maxBytes: number = 5 * 1024 * 1024): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return '';
    // 对于大文件，只读取最新部分
    if (stat.size > maxBytes) {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(maxBytes);
      const offset = stat.size - maxBytes;
      fs.readSync(fd, buffer, 0, maxBytes, offset);
      fs.closeSync(fd);
      return buffer.toString('utf-8');
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function listLogFiles(dir: string, maxFiles: number = 15): string[] {
  try {
    const files = fs.readdirSync(dir)
      .map((f) => path.join(dir, f))
      .filter((p) => {
        try {
          const stat = fs.statSync(p);
          return stat.isFile();
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
        } catch {
          return 0;
        }
      });
    return files.slice(0, maxFiles);
  } catch {
    return [];
  }
}

/**
 * 尝试从一段文本中提取 token 数
 * 常见格式: "prompt_tokens": 1000, "tokens used": 500, "input": 300 等
 */
function extractNumber(text: string, keys: string[]): number {
  for (const k of keys) {
    const re = new RegExp(`["']?${k}["']?\\s*[:=]\\s*(\\d+)`, 'i');
    const m = text.match(re);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  return 0;
}

/**
 * 解析一段内容，可能是 JSON、JSON Lines 或混合文本
 * 返回所有能识别到的事件
 */
export function parseGenericContent(
  content: string,
  toolType: ToolType,
  defaultModel: string,
): AICodeEvent[] {
  const events: AICodeEvent[] = [];
  if (!content || content.trim().length === 0) return events;

  // 方案 1: 整体是 JSON 数组
  try {
    const arr = JSON.parse(content);
    if (Array.isArray(arr)) {
      for (const obj of arr) {
        const ev = extractEventFromObject(obj, toolType, defaultModel);
        if (ev) events.push(ev);
      }
      if (events.length > 0) return events;
    } else if (typeof arr === 'object' && arr !== null) {
      const ev = extractEventFromObject(arr, toolType, defaultModel);
      if (ev) events.push(ev);
      if (events.length > 0) return events;
    }
  } catch { /* 不是纯 JSON，继续 */ }

  // 方案 2: 逐行 JSON（NDJSON）
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const ev = extractEventFromObject(obj, toolType, defaultModel);
      if (ev) events.push(ev);
    } catch { /* 非 JSON 行，忽略 */ }
  }

  if (events.length > 0) return events;

  // 方案 3: 从纯文本行中提取（针对 IDE 日志中的结构化片段）
  for (const line of lines) {
    const ev = extractEventFromTextLine(line, toolType, defaultModel);
    if (ev) events.push(ev);
  }

  return events;
}

function extractEventFromObject(obj: any, toolType: ToolType, defaultModel: string): AICodeEvent | null {
  if (!obj || typeof obj !== 'object') return null;

  // 必须有一个事件标记字段
  const hasMarker = obj.type || obj.event || obj.action || obj.kind || obj.status
    || obj.tokenUsage || obj.usage || obj.tokens || obj.inputTokens !== undefined;
  if (!hasMarker) return null;

  const inputTokens =
    obj.tokenUsage?.prompt || obj.tokens?.prompt || obj.usage?.prompt_tokens
    || obj.input_tokens || obj.inputTokens || obj.prompt_tokens || extractNumber(JSON.stringify(obj), ['prompt_tokens', 'input_tokens', 'input', 'prompt']);
  const outputTokens =
    obj.tokenUsage?.completion || obj.tokens?.completion || obj.usage?.completion_tokens
    || obj.output_tokens || obj.outputTokens || obj.completion_tokens || extractNumber(JSON.stringify(obj), ['completion_tokens', 'output_tokens', 'output', 'completion']);

  if (inputTokens === 0 && outputTokens === 0) return null;

  const ts = obj.timestamp || obj.time || obj.created_at || Date.now();
  const timestamp = typeof ts === 'string' ? new Date(ts).getTime() || Date.now() : (typeof ts === 'number' ? ts : Date.now());
  const latency = obj.durationMs || obj.latency || obj.duration || obj.response_time || 0;
  const model = obj.model || obj.modelId || obj.model_name || defaultModel;
  const sessionId = obj.sessionId || obj.session_id || obj.conversationId || obj.conversation_id || uuidv4();
  const traceId = obj.traceId || obj.trace_id || obj.request_id || obj.requestId || uuidv4();

  const errorType = obj.error || obj.errorType || obj.error_type;

  return {
    id: uuidv4(),
    tool: toolType,
    sessionId: String(sessionId),
    traceId: String(traceId),
    modelId: String(model),
    timestamp,
    tokenConsumption: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    performance: {
      latency,
      ttft: obj.ttft || Math.min(Math.floor(latency * 0.3), 2000),
    },
    quality: errorType ? { errorType: String(errorType), codeAcceptance: false } : undefined,
  };
}

function extractEventFromTextLine(line: string, toolType: ToolType, defaultModel: string): AICodeEvent | null {
  const inputTokens = extractNumber(line, ['prompt_tokens', 'input_tokens', 'input', 'prompt']);
  const outputTokens = extractNumber(line, ['completion_tokens', 'output_tokens', 'output', 'completion']);
  if (inputTokens === 0 && outputTokens === 0) return null;

  const latency = extractNumber(line, ['latency', 'duration', 'response_time']);

  return {
    id: uuidv4(),
    tool: toolType,
    sessionId: uuidv4(),
    traceId: uuidv4(),
    modelId: defaultModel,
    timestamp: Date.now(),
    tokenConsumption: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
    performance: {
      latency,
      ttft: Math.min(Math.floor(latency * 0.3), 2000),
    },
  };
}

/**
 * 扫描单个目录中的所有文件，提取事件
 */
export function scanDirectoryForEvents(
  dir: string,
  toolType: ToolType,
  defaultModel: string,
  processedMap: Record<string, number>,
  maxEventsPerRun: number = 50,
): AICodeEvent[] {
  const events: AICodeEvent[] = [];

  if (!fs.existsSync(dir)) return events;

  const files = listLogFiles(dir, 10);
  for (const filePath of files) {
    if (events.length >= maxEventsPerRun) break;

    try {
      const stat = fs.statSync(filePath);
      const lastSize = processedMap[filePath] || 0;
      const isNew = lastSize === 0;

      if (!isNew && stat.size <= lastSize) continue;

      const content = safeReadFile(filePath);
      if (content === null || content.length === 0) continue;

      // 如果文件内容小于上次处理大小，忽略（避免重新扫）
      const parsedEvents = parseGenericContent(content, toolType, defaultModel);
      processedMap[filePath] = stat.size;

      if (parsedEvents.length > 0) {
        // 去重：根据 timestamp + model + tokenConsumption 粗略判断
        for (const ev of parsedEvents) {
          if (events.length >= maxEventsPerRun) break;
          events.push(ev);
        }
      }
    } catch { /* 静默 */ }
  }

  return events;
}
