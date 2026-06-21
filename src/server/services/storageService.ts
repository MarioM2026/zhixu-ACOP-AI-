import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// 支持通过环境变量设置数据目录（Electron 环境下使用）
// 优先级: ZHIXU_DATA_DIR > process.cwd()/data
const DATA_DIR =
  process.env.ZHIXU_DATA_DIR && process.env.ZHIXU_DATA_DIR.trim()
    ? process.env.ZHIXU_DATA_DIR.trim()
    : path.join(process.cwd(), 'data');

const pendingWrites: Map<string, NodeJS.Timeout> = new Map();
const DEBOUNCE_MS = 2000;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    logger.info('[Storage] 创建数据目录', { path: DATA_DIR });
  }
}

function filePath(name: string): string {
  return path.join(DATA_DIR, `${name}.json`);
}

export async function loadJSON<T>(name: string, defaultValue: T): Promise<T> {
  ensureDataDir();
  const p = filePath(name);
  try {
    if (!fs.existsSync(p)) {
      logger.info('[Storage] 文件不存在，使用默认值', { name });
      return defaultValue;
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const data = JSON.parse(raw) as T;
    logger.info('[Storage] 加载成功', { name, path: p });
    return data;
  } catch (error) {
    logger.error('[Storage] 加载失败，使用默认值', { name, error: String(error) });
    return defaultValue;
  }
}

export async function saveJSON<T>(name: string, data: T): Promise<void> {
  ensureDataDir();
  const p = filePath(name);
  try {
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(p, json, 'utf-8');
    logger.info('[Storage] 写入成功', { name, path: p });
  } catch (error) {
    logger.error('[Storage] 写入失败', { name, error: String(error) });
    throw error;
  }
}

export function schedulePersist<T>(name: string, getData: () => T): void {
  if (pendingWrites.has(name)) {
    const t = pendingWrites.get(name);
    if (t) clearTimeout(t);
  }
  const timer = setTimeout(async () => {
    try {
      await saveJSON(name, getData());
    } catch (error) {
      logger.error('[Storage] 延迟写入失败', { name, error: String(error) });
    } finally {
      pendingWrites.delete(name);
    }
  }, DEBOUNCE_MS);
  pendingWrites.set(name, timer);
}

export function flushAll(): void {
  logger.info('[Storage] 强制刷新所有挂起的写入');
  pendingWrites.forEach((timer) => {
    clearTimeout(timer);
  });
  pendingWrites.clear();
}
