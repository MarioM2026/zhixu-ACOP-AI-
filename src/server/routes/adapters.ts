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
    res.json({ success: true, message: `Adapter ${toolType} configured` });
  } catch (error) {
    logger.error('Failed to configure adapter', { error: String(error) });
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
