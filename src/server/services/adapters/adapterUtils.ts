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
    function collectRecursive(currentDir: string, depth: number): string[] {
      if (depth > 4) return []; // 避免无限递归
      const result: string[] = [];
      try {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              result.push(...collectRecursive(fullPath, depth + 1));
            } else if (stat.isFile() && item.endsWith('.log')) {
              result.push(fullPath);
            }
          } catch (e) {} // 权限问题等跳过
        }
      } catch (e) {}
      return result;
    }

    const files = collectRecursive(dir, 0);
    return files
      .sort((a, b) => {
        try {
          return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
        } catch {
          return 0;
        }
      })
      .slice(0, maxFiles);
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
 * 从一行日志中精确匹配字段值（支持 Rust tracing 多种格式）
 * 使用单词边界和负向后瞻确保字段名是独立的词：
 *   session_id="xxx"           ✓ 匹配
 *   session_id: "xxx"          ✓ 匹配
 *   session_id=Some("xxx")     ✓ 匹配
 *   connect_session_id="xxx"   ✗ 不匹配（前面有 connect_）
 *   chat_session_id: xxx       ✓ 匹配（明确包含 chat）
 */
function matchRustField(
  line: string,
  fieldNames: string[],
  excludePrefixes: string[] = ['connect_', 'client_', 'common_'],
): string | null {
  // 构建字段名模式（转义特殊字符）
  const fieldPattern = fieldNames
    .map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  // 构建负向后瞻（排除前缀）
  const lookBehind = excludePrefixes.length > 0
    ? `(?<!${excludePrefixes.join('|')})`
    : '';

  // 格式 1: 带引号的值 field="value" 或 field: "value" 或 field=Some("value")
  // 允许字段名出现在行首、空白后，或其他分隔符后
  const quotedRe = new RegExp(
    `(?:^|[\\s{,;])${lookBehind}(?:${fieldPattern})(?:\\s*[:=]\\s*)(?:Some\\(\\s*["']([^"']+)["']\\s*\\)|["']([^"',}\\]\\s]+)["'])`,
    'i'
  );
  const quoted = line.match(quotedRe);
  if (quoted) return quoted[1] || quoted[2];

  // 格式 2: 无引号的值 field=UUID 或 field:value 或 field=Some(UUID)
  const bareRe = new RegExp(
    `(?:^|[\\s{,;])${lookBehind}(?:${fieldPattern})(?:\\s*[:=]\\s*)(?:Some\\(\\s*([A-Za-z0-9][A-Za-z0-9_-]{3,})\\s*\\)|([A-Za-z0-9][A-Za-z0-9_-]{3,}))`,
    'i'
  );
  const bare = line.match(bareRe);
  return bare ? bare[1] || bare[2] : null;
}

/**
 * 专门提取 chat_session_id 或明确 session_id（不是 connect_session_id / session=UUID）
 *
 * 匹配规则：
 *   ✅ chat_session_id: "UUID" / chat_session_id=UUID    → 真实对话 session
 *   ✅ session_id: "UUID"   / session_id=UUID             → 明确 session（前面必须是空白/起始/分隔符）
 *   ✗ connect_session_id="UUID"                          → IPC 通道（不匹配，因为 session_id 前是 _）
 *   ✗ session=Some("UUID") / session=UUID              → IPC session（不匹配，因为字段是 session 不是 session_id）
 *   ✗ message_id: "UUID" / task_id: "UUID"              → 消息/task ID（不匹配）
 */
function extractTraeSessionId(line: string): string | null {
  // 1. chat_session_id: "UUID" / chat_session_id="UUID"
  const chat1 = line.match(/chat_session_id\s*[:=]\s*(?:Some\(\s*["']([0-9a-fA-F-]{8,})["']\s*\)|["']([0-9a-fA-F-]{8,})["'])/i);
  if (chat1) return chat1[1] || chat1[2];

  // 2. chat_session_id=UUID（无引号）
  const chat2 = line.match(/chat_session_id\s*[:=]\s*([a-f0-9]{8,}-[a-f0-9-]{4,})/i);
  if (chat2) return chat2[1];

  // 3. session_id: "UUID" / session_id=UUID — 但只在行中还有 model_name 或 TimingCost 或 calling generate 时才接受
  // 这样可以避免把 IPC 中的纯 session_id 行当成 AI 调用
  if (/model_name\s*[:=]\s*["']?[^"',}\s]{2,}/i.test(line)
      || /TimingCost|calling generate|generate complete|gateway_server_processing/i.test(line)) {
    const quoted = line.match(
      /(?:^|\s|,|{)session_id\s*[:=]\s*(?:Some\(\s*["']([0-9a-fA-F-]{8,})["']\s*\)|["']([0-9a-fA-F-]{8,})["'])/i
    );
    if (quoted) return quoted[1] || quoted[2];

    const bare = line.match(
      /(?:^|\s|,|{)session_id\s*[:=]\s*(?:Some\(\s*([0-9a-fA-F-]{8,})\s*\)|([0-9a-fA-F-]{8,}))/i
    );
    if (bare) return bare[1] || bare[2];
  }

  return null;
}

/**
 * 严格提取模型名称（只接受带引号的真实模型名）
 */
function extractTraeModelName(line: string): string | null {
  const configName = line.match(/["']?config_name["']?\s*[:=]\s*["']([^"',}{]+?)["']/i);
  if (configName && configName[1]) {
    const name = configName[1].trim();
    if (isValidModelName(name)) return name;
  }

  const quotedMatch = line.match(
    /model_name\s*[:=]\s*(?:Some\(\s*["']([^"',}\s]+)["']\s*\)|["']([^"',}\s]+)["'])/i
  );
  if (quotedMatch) {
    const name = (quotedMatch[1] || quotedMatch[2] || '').trim();
    if (isValidModelName(name)) return name;
  }

  const modelMatch = line.match(
    /(?:^|\s|,|{)model\s*[:=]\s*(?:Some\(\s*["']([^"',}\s]+)["']\s*\)|["']([^"',}\s]+)["'])/i
  );
  if (modelMatch) {
    const name = (modelMatch[1] || modelMatch[2] || '').trim();
    if (isValidModelName(name)) return name;
  }

  return null;
}

/**
 * 判断字符串是否为有效的模型名称
 */
function isValidModelName(name: string): boolean {
  if (!name || name.length < 2) return false;
  const lower = name.toLowerCase();
  const invalid = new Set(['auto', 'none', 'null', 'string', 'object', 'array', 'number', 'undefined', 'default', 'config', 'setup', 'init']);
  if (invalid.has(lower)) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

/**
 * 从一行日志中提取带单位的时间值（ms/ns/us/μs/s）
 */
function extractDurationMs(line: string, fieldNames: string[]): number {
  const fieldPattern = fieldNames.join('|');
  const re = new RegExp(
    `(?:${fieldPattern})(?:[^\\d]*)((?:\\d+\\.?\\d*)|\\d+)(?:\\s*(ms|ns|us|μs|s))?`,
    'i'
  );
  const m = line.match(re);
  if (!m || !m[1]) return 0;
  const raw = parseFloat(m[1]);
  if (isNaN(raw)) return 0;
  const unit = (m[2] || 'ms').toLowerCase();
  if (unit === 'ns') return raw / 1000000;
  if (unit === 'us' || unit === 'μs') return raw / 1000;
  if (unit === 's') return raw * 1000;
  return raw;
}

/**
 * 从一行日志中提取数字（用于 tokens 等）
 */
function extractNumberFromField(line: string, fieldNames: string[]): number {
  const fieldPattern = fieldNames.join('|');
  const re = new RegExp(`(?:${fieldPattern})(?:[^\\d]*)((?:\\d+\\.?\\d*)|\\d+)`, 'i');
  const m = line.match(re);
  if (!m || !m[1]) return 0;
  const raw = parseInt(m[1], 10);
  if (isNaN(raw) || raw <= 0 || raw > 100000000) return 0;
  return raw;
}

/**
 * 专门解析 Trae AI Agent 的 Rust tracing 格式日志
 * 从 ai-agent_*_stdout.log 中提取 chat_session_id、model、tokens 等信息
 *
 * 严格匹配规则（避免误识别 IPC 通道为 AI 事件）：
 *   ✅ chat_session_id: "UUID" + model_name="qwen-plus"  → 真正对话
 *   ✅ chat_session_id=UUID + [ModelConfig] Received config_name=Model  → 真正模型调用
 *   ✅ session_id=UUID + TimingCost with gateway timings  → 真正模型调用
 *   ✗ connect_session_id="UUID" + service:"healthcheck"  ✗ IPC 通道
 *   ✗ session=Some("UUID") + [aha_ipc] send              ✗ IPC 调用
 *   ✗ message_id / task_id                                ✗ 消息/task ID
 *   ✗ model_name="" / model_name="auto"                   ✗ 无实际模型
 */
export function parseTraeLog(content: string, defaultModel: string): AICodeEvent[] {
  const events: AICodeEvent[] = [];
  if (!content || content.trim().length === 0) return events;

  // 按 session_id 聚合信息
  const sessionInfo: Record<string, {
    timestamps: number[];
    traceIds: string[];
    durations: number[];
    modelNames: string[];
    lineCount: number;
    tokenEstimates: number[];
    inputTokenEstimates: number[];
    outputTokenEstimates: number[];
    hasExplicitTokenField: boolean;
    hasLlmCall: boolean;
  }> = {};

  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // 严格的 AI 调用关键词（更窄范围，避免普通日志行触发）
  // calling generate / generate complete / ModelConfig / TimingCost / llm_invoke / tokens_used
  const llmKeywords = /(calling generate|generate complete|ModelConfig|TimingCost|llm_invoke|llm_call|tokens_used|do_chat|chat_completion|model_call)/i;

  // 从 TimingCost JSON 中提取配置/处理时长/网关时长
  const gatewayTimingRe = /"gateway_server_processing_time"\s*[:=]\s*(\d+)/i;
  const configNameRe = /"config_name"\s*[:=]\s*"([^"]+)"/i;

  for (const line of lines) {
    // 1. 提取 timestamp
    const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:[+-]\d{2}:?\d{2}|Z)?)/);
    const timestamp = timeMatch ? new Date(timeMatch[1].replace(',', '.')).getTime() : Date.now();

    // 2. 提取 chat_session_id 或 session_id（严格模式）
    const sessionId = extractTraeSessionId(line);
    if (!sessionId || sessionId.toLowerCase() === 'none' || sessionId.length < 8) continue;

    // 2a. 过滤：如果同一行有 message_id=sessionId 或 task_id=sessionId → 这不是 session 而是消息 ID
    if (line.indexOf(`message_id: ${sessionId}`) !== -1
      || line.indexOf(`message_id="${sessionId}"`) !== -1
      || line.indexOf(`task_id: ${sessionId}`) !== -1
      || line.indexOf(`task_id="${sessionId}"`) !== -1) continue;

    // 3. 提取 trace_id / request_id（仅限 Rust tracing 格式）
    const traceId = matchRustField(line, ['trace_id', 'traceId', 'request_id', 'requestId', 'trace', 'span_id', 'spanId']);

    // 4. 提取 duration — 支持带单位的 time_cost 等
    const durationMs = extractDurationMs(line, [
      'total_duration', 'duration_ms', 'latency_ms', 'latency',
      'time_cost', 'cost_ms', 'response_time', 'elapsed', 'elapsed_ms',
      'took', 'took_ms', 'duration',
    ]);

    // 4a. 从 TimingCost 行提取网关处理时长（更准确的 AI 调用延迟）
    const gatewayMatch = line.match(gatewayTimingRe);
    let gatewayDuration = 0;
    if (gatewayMatch && gatewayMatch[1]) {
      gatewayDuration = parseInt(gatewayMatch[1], 10);
    }

    // 5. 提取模型名 — 严格模式（只接受带引号的真实模型名）
    // 过滤 auto/String/None/Null/数字 等无效值
    let modelName: string | null = extractTraeModelName(line);
    if (modelName) {
      if (/__/.test(modelName)) {
        const base = modelName.split('__')[0];
        if (base.length >= 3) modelName = base;
      }
      if (/[\\/]/.test(modelName)) {
        const parts = modelName.split(/[\\/]/);
        const candidate = parts[parts.length - 1];
        if (candidate.length > 0) modelName = candidate;
      }
    }

    // 5a. 从 TimingCost 行提取 config_name（作为模型名称）
    const configNameMatch = line.match(configNameRe);
    if (!modelName && configNameMatch && configNameMatch[1]) {
      const cn = configNameMatch[1];
      if (isValidModelName(cn)) {
        modelName = cn;
      }
    }

    // 6. 提取 tokens
    const totalTokens = extractNumberFromField(line, ['total_tokens', 'tokens_used', 'tokens']);
    const inputTokensVal = extractNumberFromField(line, ['prompt_tokens', 'input_tokens', 'prompt', 'prompt_max_tokens']);
    const outputTokensVal = extractNumberFromField(line, ['completion_tokens', 'output_tokens', 'completion', 'generated_tokens']);

    const explicitTokens = totalTokens > 0 ? totalTokens : (inputTokensVal + outputTokensVal);

    // 7. 严格判断是否为 AI 模型调用行
    // 必须满足：有关键词 OR 有明确 tokens OR 有模型名+（时长 / tokens）
    const hasKeyword = llmKeywords.test(line);
    const hasValidModel = modelName !== null;
    const hasTokens = explicitTokens > 0 || inputTokensVal > 0 || outputTokensVal > 0;
    const hasGateway = gatewayDuration > 0;

    // 至少满足 2 个条件才认为是真正 AI 相关行
    const isLlmCall = (hasKeyword && hasValidModel)
      || (hasValidModel && (hasTokens || hasGateway || durationMs > 0))
      || (hasKeyword && hasTokens)
      || hasGateway;

    // 过滤掉无 AI 标记但有 session_id 的普通日志行
    if (!isLlmCall) {
      // 仅当该行有真正 AI 特征时才记录
      if (!hasKeyword && !hasValidModel && !hasTokens && !hasGateway && durationMs === 0) continue;
    }

    // 聚合到 session
    if (!sessionInfo[sessionId]) {
      sessionInfo[sessionId] = {
        timestamps: [], traceIds: [], durations: [],
        modelNames: [], lineCount: 0,
        tokenEstimates: [], inputTokenEstimates: [], outputTokenEstimates: [],
        hasExplicitTokenField: false, hasLlmCall: false,
      };
    }
    const info = sessionInfo[sessionId];
    info.timestamps.push(timestamp);
    info.lineCount++;
    if (traceId) info.traceIds.push(traceId);
    if (durationMs > 0) info.durations.push(durationMs);
    if (gatewayDuration > 0) info.durations.push(gatewayDuration);
    if (modelName) info.modelNames.push(modelName);
    if (explicitTokens > 0) {
      info.tokenEstimates.push(explicitTokens);
      info.hasExplicitTokenField = true;
    }
    if (inputTokensVal > 0) info.inputTokenEstimates.push(inputTokensVal);
    if (outputTokensVal > 0) info.outputTokenEstimates.push(outputTokensVal);
    if (isLlmCall) info.hasLlmCall = true;
  }

  // 为每个 session 生成事件（要求严格的 AI 标记）
  for (const [sessionId, info] of Object.entries(sessionInfo)) {
    // 严格过滤：必须有真实模型名（排除 auto/String/None 等）
    // 或者：有明确 token 字段 + 有 AI 调用关键词
    const realModelNames = info.modelNames.filter((m) => isValidModelName(m));
    const hasRealModel = realModelNames.length > 0;
    const hasRealTokens = info.hasExplicitTokenField;
    const hasLlmKeyword = info.hasLlmCall;

    // 最低要求：真实模型名 或 (明确token + AI关键词)
    if (!hasRealModel && !(hasRealTokens && hasLlmKeyword)) continue;
    if (info.lineCount < 1) continue;

    // 过滤：所有 modelNames 都是无效值（如全是 "auto"、"String"）→ 跳过
    if (info.modelNames.length > 0 && realModelNames.length === 0 && !hasRealTokens) continue;

    const minTime = Math.min(...info.timestamps);
    const maxTime = Math.max(...info.timestamps);
    const avgDuration = info.durations.length > 0
      ? Math.round(info.durations.reduce((s, x) => s + x, 0) / info.durations.length)
      : Math.max(100, Math.round((maxTime - minTime) / Math.max(info.lineCount, 1)));

    // Token 计算：
    // 1) 优先使用显式 input_tokens / output_tokens
    // 2) 再使用 total_tokens（按比例分配）
    // 3) 有真正模型调用但无 token 信息时 → 使用基于时长的保守估算
    let inputTokens: number, outputTokens: number, totalTokens: number;
    if (info.inputTokenEstimates.length > 0 || info.outputTokenEstimates.length > 0) {
      const avgInput = info.inputTokenEstimates.length > 0
        ? Math.round(info.inputTokenEstimates.reduce((s, x) => s + x, 0) / info.inputTokenEstimates.length)
        : 0;
      const avgOutput = info.outputTokenEstimates.length > 0
        ? Math.round(info.outputTokenEstimates.reduce((s, x) => s + x, 0) / info.outputTokenEstimates.length)
        : 0;
      if (avgInput > 0 && avgOutput === 0) {
        inputTokens = avgInput;
        outputTokens = Math.round(avgInput * 0.67);
      } else if (avgOutput > 0 && avgInput === 0) {
        outputTokens = avgOutput;
        inputTokens = Math.round(avgOutput * 1.5);
      } else {
        inputTokens = avgInput;
        outputTokens = avgOutput;
      }
      totalTokens = inputTokens + outputTokens;
    } else if (info.hasExplicitTokenField && info.tokenEstimates.length > 0) {
      totalTokens = Math.round(
        info.tokenEstimates.reduce((s, x) => s + x, 0) / info.tokenEstimates.length
      );
      inputTokens = Math.round(totalTokens * 0.6);
      outputTokens = Math.round(totalTokens * 0.4);
    } else if (info.hasLlmCall) {
      // 只有真正的模型调用才估算 tokens，且使用更保守的值
      const tokensPerCall = Math.max(500, Math.min(2000, 800 + Math.min(avgDuration, 1000)));
      totalTokens = tokensPerCall;
      inputTokens = Math.round(totalTokens * 0.6);
      outputTokens = Math.round(totalTokens * 0.4);
    } else {
      // 没有真正模型调用也没有明确 tokens → 跳过这个 session
      continue;
    }

    // 选择最常见的模型（严格过滤无效值）
    let model = defaultModel;
    const validModels = info.modelNames.filter((m) => isValidModelName(m));
    if (validModels.length > 0) {
      const counts: Record<string, number> = {};
      for (const m of validModels) {
        counts[m] = (counts[m] || 0) + 1;
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      model = sorted[0][0];
    }

    // 最终安全检查：如果 model 仍为 defaultModel 且没有显式 token + AI 关键词 → 跳过（这很可能不是真实 AI 调用）
    if (!isValidModelName(model) && !(hasRealTokens && hasLlmKeyword)) continue;

    events.push({
      id: uuidv4(),
      tool: 'trae',
      sessionId,
      traceId: info.traceIds.length > 0 ? info.traceIds[0] : sessionId,
      modelId: model,
      timestamp: maxTime,
      tokenConsumption: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      performance: {
        latency: avgDuration,
        ttft: Math.round(avgDuration * 0.3),
      },
    });
  }

  return events;
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

  const files = listLogFiles(dir, 15); // 增加到 15 个（之前是 10）
  for (const filePath of files) {
    if (events.length >= maxEventsPerRun) break;

    try {
      const stat = fs.statSync(filePath);
      const lastSize = processedMap[filePath] || 0;
      const isNew = lastSize === 0;

      if (!isNew && stat.size <= lastSize) continue;

      let content: string | null = null;
      if (isNew) {
        // 新文件：读取全部内容（最多 10MB）
        content = safeReadFile(filePath, 10 * 1024 * 1024);
      } else {
        // 已有文件：仅读取新增部分
        const increment = stat.size - lastSize;
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(Math.min(increment, 5 * 1024 * 1024));
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        content = bytesRead > 0 ? buf.toString('utf8', 0, bytesRead) : '';
      }
      if (content === null || content.length === 0) continue;

      // Trae Rust tracing 格式日志用专用解析器；其他文件仅在有显式 token 字段时用通用解析器
      let parsedEvents: AICodeEvent[] = [];
      const fileName = path.basename(filePath).toLowerCase();

      // 仅对包含明确 "ai-agent_*_stdout.log" 或 Trae 专用日志名的文件用 parseTraeLog
      const isTraeRustTracingLog =
        (fileName.includes('ai-agent') && fileName.includes('stdout')) ||
        fileName.includes('ai-agent_stderr') ||
        fileName.startsWith('alog_') ||
        (fileName.includes('trae') && fileName.endsWith('.log'));

      if (isTraeRustTracingLog) {
        parsedEvents = parseTraeLog(content, defaultModel);
      }
      // 其他文件只通过 parseGenericContent 解析（要求有显式 token 字段）
      if (parsedEvents.length === 0) {
        parsedEvents = parseGenericContent(content, toolType, defaultModel);
      }

      processedMap[filePath] = stat.size;

      if (parsedEvents.length > 0) {
        for (const ev of parsedEvents) {
          if (events.length >= maxEventsPerRun) break;
          events.push(ev);
        }
      }
    } catch { /* 静默 */ }
  }

  return events;
}
