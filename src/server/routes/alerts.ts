import express from 'express';
import { sendTestAlert, setChannelConfig, getChannelConfig, getEnabledChannels, clearChannelConfig } from '../services/alertService';
import { getAlerts, acknowledgeAlert, acknowledgeAllAlerts, resetAlertsToSample, clearAllAlerts, hasRealAlerts } from '../services/ruleService';
import { logger } from '../services/logger';

const router = express.Router();

// 获取告警列表（支持 limit / unacknowledged 过滤）
router.get('/', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 0;
    const unacknowledged = req.query.unacknowledged === 'true';
    const allAlerts = await getAlerts();
    let result = allAlerts;
    if (unacknowledged) {
      result = result.filter((a) => !a.acknowledged);
    }
    if (limit > 0) {
      result = result.slice(0, limit);
    }
    res.json({ success: true, data: result, total: allAlerts.length, filtered: result.length });
  } catch (error) {
    next(error);
  }
});

// 确认告警
router.post('/:id/ack', async (req, res, next) => {
  try {
    await acknowledgeAlert(req.params.id);
    res.json({ success: true, message: '告警已确认' });
  } catch (error) {
    next(error);
  }
});

// 一键确认所有未处理告警
router.post('/ack-all', async (_req, res, next) => {
  try {
    const count = await acknowledgeAllAlerts();
    logger.info('All alerts acknowledged', { count });
    res.json({ success: true, message: `已确认 ${count} 条告警`, count });
  } catch (error) {
    next(error);
  }
});

// 重置告警：清空后恢复为 15 条模拟数据
router.post('/reset', async (_req, res) => {
  try {
    const count = await resetAlertsToSample();
    logger.info('Alerts reset to sample data', { count });
    res.json({ success: true, message: '已重置为 ' + count + ' 条模拟告警', count });
  } catch (error) {
    logger.error('Reset alerts failed', { error: String(error) });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// 清空所有告警记录
router.delete('/all', async (_req, res) => {
  try {
    await clearAllAlerts();
    logger.info('All alerts cleared');
    res.json({ success: true, message: '所有告警已清空' });
  } catch (error) {
    logger.error('Clear all alerts failed', { error: String(error) });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// 查询当前告警是否是真实数据
router.get('/status', (_req, res) => {
  res.json({ success: true, hasRealData: hasRealAlerts() });
});

// 测试发送告警
router.post('/test', async (req, res, next) => {
  try {
    const { channel, config } = req.body;
    
    logger.info('Received alert test request', { channel, config: { 
      ...config, 
      password: config?.password ? '***' : undefined,
      secret: config?.secret ? '***' : undefined 
    } });

    if (!channel) {
      logger.warn('Alert test failed: missing channel');
      res.status(400).json({ success: false, message: '缺少渠道参数' });
      return;
    }

    const result = await sendTestAlert(channel, config);

    logger.info('Alert test result', { channel, success: result.success, message: result.message });
    
    res.json({
      success: result.success,
      message: result.message,
      details: result.details,
    });
  } catch (error) {
    logger.error('Alert test error', { error: String(error) });
    next(error);
  }
});

// 保存通道配置（供规则引擎使用）
router.post('/config', (req, res) => {
  try {
    const { channel, config, enabled } = req.body;

    if (!channel || !config) {
      res.status(400).json({ success: false, message: '缺少 channel 或 config 参数' });
      return;
    }

    setChannelConfig(channel, config, enabled !== false);
    logger.info(`Channel config saved: ${channel}`, { enabled: enabled !== false });

    res.json({
      success: true,
      message: `通道 ${channel} 配置已保存`,
      enabledChannels: getEnabledChannels(),
    });
  } catch (error) {
    logger.error('Channel config save error', { error: String(error) });
    res.status(500).json({ success: false, message: String(error) });
  }
});

// 获取所有已启用的通道
router.get('/channels', (_req, res) => {
  res.json({
    success: true,
    channels: getEnabledChannels().map((ch) => ({ channel: ch, enabled: !!getChannelConfig(ch)?.enabled })),
  });
});

// 获取单个通道配置
router.get('/config/:channel', (req, res) => {
  const cfg = getChannelConfig(req.params.channel);
  res.json({ success: true, data: cfg ? { ...cfg, config: cfg.config } : null });
});

// 删除通道配置
router.delete('/config/:channel', (req, res) => {
  clearChannelConfig(req.params.channel);
  res.json({ success: true, message: '配置已清除' });
});

export { router as alertRoutes };
