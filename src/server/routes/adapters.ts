import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger';
import { adapterService } from '../services/adapterService';
import { recordAICodeEvent } from '../services/aiCodeEventService';
import type { AICodeEvent, ToolType } from '@zhixu/shared/types';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const status = await adapterService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get adapter status', { error: String(error) });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/collect', async (_req, res) => {
  try {
    const results = await adapterService.collectAndRecord();
    const total = results.reduce((sum, r) => sum + r.count, 0);
    logger.info(`Manual adapter collect: ${total} events collected`, { results });
    res.json({ success: true, data: { results, total } });
  } catch (error) {
    logger.error('Failed to collect adapter events', { error: String(error) });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/:toolType/config', async (req, res) => {
  try {
    const toolType = req.params.toolType as ToolType;
    const { mode, logPath, enabled } = req.body;
    const ok = await adapterService.configureAdapter(toolType, { mode, logPath, enabled });
    if (!ok) {
      res.status(404).json({ success: false, error: `Adapter ${toolType} not found` });
      return;
    }
    // 配置后立即触发一次采集，使用户能看到"配置后立刻有数据"
    const results = await adapterService.collectAndRecord();
    const total = results.reduce((sum, r) => sum + r.count, 0);
    res.json({
      success: true,
      message: `Adapter ${toolType} configured`,
      data: { eventsCollected: total, results },
    });
  } catch (error) {
    logger.error('Failed to configure adapter', { error: String(error) });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/** 验证指定路径是否存在，并预览该目录下的日志文件信息，同时尝试一次扫描以预览可提取事件数 */
router.post('/:toolType/validate-path', async (req, res) => {
  try {
    const toolType = req.params.toolType as ToolType;
    const { path: inputPath, doScan } = req.body as { path?: string; doScan?: boolean };
    if (!inputPath || typeof inputPath !== 'string' || inputPath.trim() === '') {
      res.status(400).json({ success: false, error: '路径不能为空' });
      return;
    }
    const trimmed = inputPath.trim();
    // 1. 验证路径存在且为目录
    const fs = await import('fs');
    if (!fs.existsSync(trimmed)) {
      res.status(200).json({
        success: false,
        path: trimmed,
        exists: false,
        isDirectory: false,
        logFiles: [],
        message: '该路径不存在，请检查拼写或路径是否正确',
      });
      return;
    }
    const stat = fs.statSync(trimmed);
    if (!stat.isDirectory()) {
      res.status(200).json({
        success: false,
        path: trimmed,
        exists: true,
        isDirectory: false,
        logFiles: [],
        message: '该路径是文件而非目录，请指定到日志所在目录',
      });
      return;
    }
    // 2. 递归扫描该目录下的 .log 文件（复用 adapterUtils 中的 listLogFiles）
    const { listLogFiles, scanDirectoryForEvents } = await import('../services/adapters/adapterUtils');
    const allFiles = listLogFiles(trimmed, 50);
    const totalSize = allFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(f).size; } catch { return sum; }
    }, 0);

    // 3. 识别 Trae 相关日志（ai-agent 前缀 / trae / chat_turn）
    const traeLogs = allFiles.filter((f) => {
      const name = f.toLowerCase();
      return name.includes('ai-agent') || name.includes('trae') || name.includes('chat_turn');
    });

    // 4. （可选）尝试一次扫描，预览可识别事件数
    let previewEvents: number = 0;
    let previewModels: string[] = [];
    let previewTokens: number = 0;
    if (doScan !== false) {
      try {
        const defaultModel = toolType === 'claude_code' ? 'claude-sonnet-4' :
          toolType === 'cursor' ? 'gpt-4o' : 'qwen-plus';
        // 临时 scan 用空 processedMap（只预览不计入持久化）
        const preview = scanDirectoryForEvents(trimmed, toolType, defaultModel, {}, 30);
        previewEvents = preview.length;
        const modelSet = new Set<string>();
        preview.forEach((e) => {
          modelSet.add(e.modelId);
          previewTokens += e.tokenConsumption.total;
        });
        previewModels = Array.from(modelSet).slice(0, 8);
      } catch (scanErr) {
        logger.warn('Path validation preview scan failed', { error: String(scanErr) });
      }
    }

    // 5. 组装消息
    let message: string;
    if (previewEvents > 0) {
      message = `✅ 目录有效，已发现 ${allFiles.length} 个日志文件（${traeLogs.length} 个 Trae 相关），预计可识别 ${previewEvents} 个事件，涉及模型: ${previewModels.join('、')}`;
    } else if (traeLogs.length > 0) {
      message = `⚠️ 目录存在，已扫描 ${allFiles.length} 个日志文件（${traeLogs.length} 个与 Trae 相关），暂未检测到可解析事件，请确认日志内容或稍后重试。`;
    } else if (allFiles.length > 0) {
      message = `⚠️ 目录存在，但未检测到 Trae 风格的 .log 文件（预期 ai-agent_*_stdout.log 等）。已登记 ${allFiles.length} 个日志文件，保存后将开始扫描。`;
    } else {
      message = `⚠️ 目录存在，但目录下没有 .log 文件，请检查是否指向正确的日志输出目录。`;
    }

    res.status(200).json({
      success: true,
      path: trimmed,
      exists: true,
      isDirectory: true,
      totalLogFiles: allFiles.length,
      totalSizeBytes: totalSize,
      logFiles: allFiles.slice(0, 20),
      traeRelatedLogs: traeLogs.length,
      previewEvents,
      previewModels,
      previewTokens,
      message,
    });
  } catch (error) {
    logger.error('Failed to validate adapter path', { error: String(error) });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/:toolType/event', async (req, res) => {
  try {
    const toolType = req.params.toolType as ToolType;
    const body = req.body as Partial<AICodeEvent> & {
      sessionId?: string; modelId?: string;
      tokenConsumption?: { input: number; output: number; total?: number };
      performance?: { latency?: number; ttft?: number };
    };

    const adapter = adapterService.getAdapter(toolType);
    if (adapter && adapter.submitManualEvent) {
      const ev = adapter.submitManualEvent({
        sessionId: body.sessionId || uuidv4(),
        modelId: body.modelId || (toolType === 'claude_code' ? 'claude-sonnet-4' : toolType === 'cursor' ? 'gpt-4o' : 'qwen-plus'),
        tokenConsumption: body.tokenConsumption || { input: 200, output: 500, total: 700 },
        performance: body.performance || { latency: 2000, ttft: 500 },
        quality: body.quality,
      });
      await recordAICodeEvent(ev);
      logger.info(`Manual event submitted via adapter: ${toolType}`, { eventId: ev.id });
      res.json({ success: true, data: ev });
    } else {
      const sessionId = body.sessionId || uuidv4();
      const modelId = body.modelId || (toolType === 'claude_code' ? 'claude-sonnet-4' : toolType === 'cursor' ? 'gpt-4o' : 'qwen-plus');
      const tokenConsumption = body.tokenConsumption || { input: 200, output: 500, total: 700 };
      const performance = body.performance || { latency: 2000, ttft: 500 };
      const event: AICodeEvent = { id: uuidv4(), sessionId, traceId: uuidv4(), tool: toolType, modelId, timestamp: Date.now(), tokenConsumption, performance, quality: body.quality };
      await recordAICodeEvent(event);
      res.json({ success: true, data: event });
    }
  } catch (error) {
    logger.error('Failed to submit manual event', { error: String(error) });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

export { router as adapterRoutes };
