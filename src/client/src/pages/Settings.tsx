import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast, createToastApi, ToastContainer } from '../hooks/useToast';

interface AlertConfig {
  enabled: boolean;
  channels: {
    dingtalk: {
      enabled: boolean;
      webhookUrl: string;
      secret: string;
    };
    email: {
      enabled: boolean;
      smtpServer: string;
      smtpPort: number;
      username: string;
      password: string;
      toEmails: string;
    };
    webhook: {
      enabled: boolean;
      url: string;
      secret: string;
      headers: Record<string, string>;
    };
  };
  rules: {
    tokenThreshold: number;
    errorRateThreshold: number;
    latencyThreshold: number;
  };
}

interface OtelConfig {
  endpoint: string;
  serviceName: string;
}

interface UIConfig {
  refreshInterval: number;
  theme: 'dark' | 'light';
}

// 把主题应用到 DOM（CSS 变量通过 data-theme 切换）
function applyTheme(theme: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

// 把单个告警通道配置同步到后端（这样 sendAlert 才能读到它）
async function saveChannelConfigToServer(
  channel: 'dingtalk' | 'email' | 'webhook',
  config: any,
  enabled: boolean,
): Promise<boolean> {
  try {
    const response = await fetch('/api/alerts/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, config, enabled }),
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    return data.success === true || data.success === undefined; // 兼容不同响应
  } catch (error) {
    console.error(`[Settings] 同步 ${channel} 配置到后端失败`, error);
    return false;
  }
}

function Settings() {
  const { toasts, showToast, removeToast } = useToast();
  const toast = createToastApi(showToast);

  // OpenTelemetry 配置
  const [otelConfig, setOtelConfig] = useState<OtelConfig>({
    endpoint: 'http://localhost:4318',
    serviceName: 'zhixu-server',
  });

  // 告警配置
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    enabled: true,
    channels: {
      dingtalk: {
        enabled: true,
        webhookUrl: '',
        secret: '',
      },
      email: {
        enabled: false,
        smtpServer: '',
        smtpPort: 587,
        username: '',
        password: '',
        toEmails: '',
      },
      webhook: {
        enabled: false,
        url: '',
        secret: '',
        headers: {},
      },
    },
    rules: {
      tokenThreshold: 100000,
      errorRateThreshold: 5,
      latencyThreshold: 5000,
    },
  });

  // 界面配置
  const [uiConfig, setUiConfig] = useState<UIConfig>({
    refreshInterval: 30,
    theme: 'dark',
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingDingtalk, setSendingDingtalk] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWebhook, setSendingWebhook] = useState(false);
  const [activeTab, setActiveTab] = useState<'otel' | 'alert' | 'ui' | 'adapters'>('alert');
  const [adapters, setAdapters] = useState<Array<{
    toolType: string; name: string; version: string; enabled: boolean;
    mode: string; logPath: string | null; detectedPath: string | null;
    candidatePaths: string[];
    lastCollectTime: number; totalCollected: number; lastError?: string;
    health: { status: 'healthy' | 'degraded' | 'unhealthy'; error?: string };
    metrics: { totalEvents: number; totalTokens: number; avgLatency: number; errorCount: number };
  }>>([]);
  const [adapterLoading, setAdapterLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [lastCollectResult, setLastCollectResult] = useState<number | null>(null);
  const [manualPathMap, setManualPathMap] = useState<Record<string, string>>({});
  const [validatingPath, setValidatingPath] = useState<Record<string, boolean>>({});
  const [pathValidation, setPathValidation] = useState<Record<string, {
    ok: boolean; message: string;
    logFiles?: number; totalSizeBytes?: number;
    traeRelatedLogs?: number; previewEvents?: number;
    previewModels?: string[]; previewTokens?: number;
  }>>({});
  const [manualEventExpanded, setManualEventExpanded] = useState<Record<string, boolean>>({});
  const [manualEventJson, setManualEventJson] = useState<Record<string, string>>({});

  async function loadAdapters() {
    setAdapterLoading(true);
    try {
      const response = await api.get('/api/adapters');
      if (response && response.success) {
        setAdapters(response.data || []);
      }
    } catch (error) {
      console.error('[Settings] 加载适配器状态失败', error);
      toast.error('加载适配器状态失败');
    } finally {
      setAdapterLoading(false);
    }
  }

  async function triggerCollect() {
    setCollecting(true);
    try {
      const response = await api.post('/api/adapters/collect', {});
      if (response && response.success) {
        const total = response.data?.total || 0;
        setLastCollectResult(total);
        toast.success(`采集完成，共 ${total} 条新事件`);
        loadAdapters();
      } else {
        toast.error('采集失败');
      }
    } catch (error) {
      console.error('[Settings] 触发采集失败', error);
      toast.error('采集失败');
    } finally {
      setCollecting(false);
    }
  }

  async function submitTestEvent(toolType: string) {
    try {
      const response = await api.post(`/api/adapters/${toolType}/event`, {
        sessionId: `test-${Date.now()}`,
        modelId: toolType === 'claude_code' ? 'claude-sonnet-4' : toolType === 'cursor' ? 'gpt-4o' : 'qwen-plus',
        tokenConsumption: {
          input: Math.floor(Math.random() * 800) + 200,
          output: Math.floor(Math.random() * 1500) + 500,
        },
        performance: { latency: Math.floor(Math.random() * 3000) + 500, ttft: Math.floor(Math.random() * 800) + 100 },
      });
      if (response && response.success) {
        toast.success(`${toolType} 测试事件已提交`);
        loadAdapters();
      }
    } catch (error) {
      console.error('[Settings] 提交测试事件失败', error);
      toast.error('提交测试事件失败');
    }
  }

  /** 验证路径：调用后端验证该目录下是否存在日志文件，并返回统计信息 */
  async function validatePath(toolType: string, path: string): Promise<void> {
    if (!path.trim()) return;
    setValidatingPath((prev) => ({ ...prev, [toolType]: true }));
    try {
      const response = await api.post(`/api/adapters/${toolType}/validate-path`, { path: path.trim() });
      if (response && (response as any).success !== undefined) {
        const result = response as any;
        setPathValidation((prev) => ({
          ...prev,
          [toolType]: {
            ok: !!result.success,
            message: result.message || '已验证',
            logFiles: result.totalLogFiles,
            totalSizeBytes: result.totalSizeBytes,
            traeRelatedLogs: result.traeRelatedLogs,
            previewEvents: result.previewEvents,
            previewModels: result.previewModels,
            previewTokens: result.previewTokens,
          },
        }));
      } else {
        setPathValidation((prev) => ({ ...prev, [toolType]: { ok: false, message: '验证失败' } }));
      }
    } catch (error) {
      console.error('[Settings] 路径验证失败', error);
      setPathValidation((prev) => ({ ...prev, [toolType]: { ok: false, message: '验证失败（网络错误）' } }));
    } finally {
      setValidatingPath((prev) => ({ ...prev, [toolType]: false }));
    }
  }

  async function applyManualPath(toolType: string, path: string) {
    if (!path.trim()) {
      toast.error('请输入有效的目录路径');
      return;
    }
    try {
      // 先验证路径
      setValidatingPath((prev) => ({ ...prev, [toolType]: true }));
      const validate = await api.post(`/api/adapters/${toolType}/validate-path`, { path: path.trim() });
      if (!validate || !(validate as any).success) {
        const msg = (validate as any)?.message || '路径验证失败';
        setPathValidation((prev) => ({ ...prev, [toolType]: { ok: false, message: msg } }));
        toast.error(msg);
        setValidatingPath((prev) => ({ ...prev, [toolType]: false }));
        return;
      }
      // 验证通过，显示预览信息
      const previewEvents = (validate as any).previewEvents || 0;
      setPathValidation((prev) => ({
        ...prev,
        [toolType]: {
          ok: true,
          message: (validate as any).message || '路径有效',
          logFiles: (validate as any).totalLogFiles,
          totalSizeBytes: (validate as any).totalSizeBytes,
          traeRelatedLogs: (validate as any).traeRelatedLogs,
          previewEvents,
          previewModels: (validate as any).previewModels,
          previewTokens: (validate as any).previewTokens,
        },
      }));

      // 保存配置
      const response = await api.post(`/api/adapters/${toolType}/config`, { logPath: path.trim() });
      if (response && (response as any).success) {
        // 切换到自动模式
        await api.post(`/api/adapters/${toolType}/config`, { mode: 'auto' });
        // 后端 configure 后已自动触发一次扫描，这里再触发一次保险
        const collectResp = await api.post('/api/adapters/collect', {});
        const events = (collectResp as any)?.data?.total ?? (response as any)?.data?.eventsCollected ?? previewEvents;
        if (events > 0) {
          toast.success(`✅ 目录已保存，已扫描到 ${events} 条事件`);
        } else if (previewEvents > 0) {
          toast.success(`目录已保存，预计可识别 ${previewEvents} 条事件，扫描进行中...`);
        } else {
          toast.success('目录已保存，扫描进行中（稍后刷新以查看结果）');
        }
        loadAdapters();
      } else {
        toast.error('设置失败');
      }
      setValidatingPath((prev) => ({ ...prev, [toolType]: false }));
    } catch (error) {
      console.error('[Settings] 设置目录失败', error);
      toast.error('设置失败');
      setValidatingPath((prev) => ({ ...prev, [toolType]: false }));
    }
  }

  async function submitCustomEvent(toolType: string, jsonStr: string) {
    try {
      let payload;
      try {
        payload = JSON.parse(jsonStr);
      } catch {
        toast.error('JSON 格式错误');
        return;
      }
      const response = await api.post(`/api/adapters/${toolType}/event`, payload);
      if (response && response.success) {
        toast.success('自定义事件已提交');
        loadAdapters();
      }
    } catch (error) {
      console.error('[Settings] 提交自定义事件失败', error);
      toast.error('提交失败');
    }
  }

  // 进入适配器页时自动加载一次
  useEffect(() => {
    if (activeTab === 'adapters' && adapters.length === 0) {
      loadAdapters();
    }
  }, [activeTab]);

  // 加载配置（启动时从 localStorage 读取并应用到 DOM / 后端）
  useEffect(() => {
    const savedOtel = localStorage.getItem('zhixu-otel-config');
    const savedAlert = localStorage.getItem('zhixu-alert-config');
    const savedUI = localStorage.getItem('zhixu-ui-config');

    if (savedOtel) setOtelConfig(JSON.parse(savedOtel));
    if (savedAlert) setAlertConfig(JSON.parse(savedAlert));
    if (savedUI) {
      const parsed = JSON.parse(savedUI);
      setUiConfig(parsed);
      applyTheme(parsed.theme || 'dark');
    } else {
      applyTheme('dark');
    }

    // 把已保存的告警通道配置同步到后端（否则 sendAlert 读不到）
    if (savedAlert) {
      try {
        const parsed = JSON.parse(savedAlert);
        if (parsed.channels) {
          (['dingtalk', 'email', 'webhook'] as const).forEach((ch) => {
            const c = parsed.channels[ch];
            if (c && (c.enabled || c.webhookUrl || c.smtpServer || c.url)) {
              saveChannelConfigToServer(ch, c, !!c.enabled);
            }
          });
        }
      } catch (error) {
        console.error('[Settings] 恢复告警通道配置到后端失败', error);
      }
    }
  }, []);

  // 主题变更时立即应用到 DOM
  useEffect(() => {
    applyTheme(uiConfig.theme);
  }, [uiConfig.theme]);

  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('zhixu-otel-config', JSON.stringify(otelConfig));
      localStorage.setItem('zhixu-alert-config', JSON.stringify(alertConfig));
      localStorage.setItem('zhixu-ui-config', JSON.stringify(uiConfig));
      setSaved(true);
      toast.success('配置已保存');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error('保存配置失败');
      console.error('保存配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEmailConfig = async () => {
    localStorage.setItem('zhixu-alert-config', JSON.stringify(alertConfig));
    // 同步到后端：sendAlert 从后端的 Map 读配置
    const ok = await saveChannelConfigToServer(
      'email',
      alertConfig.channels.email,
      !!alertConfig.channels.email.enabled,
    );
    if (ok) {
      toast.success('邮箱配置已保存并同步到告警服务');
    } else {
      toast.warning('本地已保存，但同步到告警服务失败，请检查后端服务');
    }
  };

  const clearEmailConfig = () => {
    setAlertConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        email: {
          enabled: false,
          smtpServer: '',
          smtpPort: 587,
          username: '',
          password: '',
          toEmails: '',
        },
      },
    }));
    localStorage.setItem('zhixu-alert-config', JSON.stringify({
      ...alertConfig,
      channels: {
        ...alertConfig.channels,
        email: {
          enabled: false,
          smtpServer: '',
          smtpPort: 587,
          username: '',
          password: '',
          toEmails: '',
        },
      },
    }));
    // 通知后端禁用此通道
    saveChannelConfigToServer('email', { enabled: false, smtpServer: '', smtpPort: 587, username: '', password: '', toEmails: '' }, false);
    toast.info('邮箱配置已清空');
  };

  const saveDingtalkConfig = async () => {
    localStorage.setItem('zhixu-alert-config', JSON.stringify(alertConfig));
    const ok = await saveChannelConfigToServer(
      'dingtalk',
      alertConfig.channels.dingtalk,
      !!alertConfig.channels.dingtalk.enabled,
    );
    if (ok) {
      toast.success('钉钉配置已保存并同步到告警服务');
    } else {
      toast.warning('本地已保存，但同步到告警服务失败，请检查后端服务');
    }
  };

  const clearDingtalkConfig = () => {
    setAlertConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        dingtalk: {
          enabled: false,
          webhookUrl: '',
          secret: '',
        },
      },
    }));
    localStorage.setItem('zhixu-alert-config', JSON.stringify({
      ...alertConfig,
      channels: {
        ...alertConfig.channels,
        dingtalk: {
          enabled: false,
          webhookUrl: '',
          secret: '',
        },
      },
    }));
    saveChannelConfigToServer('dingtalk', { enabled: false, webhookUrl: '', secret: '' }, false);
    toast.info('钉钉配置已清空');
  };

  const saveWebhookConfig = async () => {
    localStorage.setItem('zhixu-alert-config', JSON.stringify(alertConfig));
    const ok = await saveChannelConfigToServer(
      'webhook',
      alertConfig.channels.webhook,
      !!alertConfig.channels.webhook.enabled,
    );
    if (ok) {
      toast.success('Webhook 配置已保存并同步到告警服务');
    } else {
      toast.warning('本地已保存，但同步到告警服务失败，请检查后端服务');
    }
  };

  const clearWebhookConfig = () => {
    setAlertConfig(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        webhook: {
          enabled: false,
          url: '',
          secret: '',
          headers: {},
        },
      },
    }));
    localStorage.setItem('zhixu-alert-config', JSON.stringify({
      ...alertConfig,
      channels: {
        ...alertConfig.channels,
        webhook: {
          enabled: false,
          url: '',
          secret: '',
          headers: {},
        },
      },
    }));
    saveChannelConfigToServer('webhook', { enabled: false, url: '', secret: '', headers: {} }, false);
    toast.info('Webhook配置已清空');
  };

  const testConnection = async () => {
    try {
      const response = await api.get('/api/health');
      if (response.data?.success !== false) {
        toast.success('连接成功！服务状态正常');
      } else {
        toast.error('连接失败');
      }
    } catch (error) {
      toast.error('连接失败，请检查服务是否启动');
    }
  };

  const testDingtalk = async () => {
    if (!alertConfig.channels.dingtalk.webhookUrl) {
      toast.warning('请先填写钉钉 Webhook 地址');
      return;
    }
    setSendingDingtalk(true);
    try {
      const response = await api.post('/api/alerts/test', {
        channel: 'dingtalk',
        config: alertConfig.channels.dingtalk,
      });
      if (response.success) {
        toast.success('已成功发送，钉钉机器人已收到测试消息');
      } else {
        const detail = response.details;
        const msg = response.message || '钉钉测试消息发送失败';
        toast.error(`${msg}${detail ? `：${detail}` : ''}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '钉钉测试消息发送失败';
      toast.error(`发送失败：${msg}。请检查 Webhook 地址和加签密钥是否正确`);
    } finally {
      setSendingDingtalk(false);
    }
  };

  const testEmail = async () => {
    if (!alertConfig.channels.email.smtpServer || !alertConfig.channels.email.toEmails) {
      toast.warning('请先填写完整的邮箱配置');
      return;
    }
    if (!alertConfig.channels.email.username || !alertConfig.channels.email.password) {
      toast.warning('请填写 SMTP 用户名和密码（授权码）');
      return;
    }
    setSendingEmail(true);
    try {
      const response = await api.post('/api/alerts/test', {
        channel: 'email',
        config: alertConfig.channels.email,
      });
      if (response.success) {
        const serverInfo = `（${alertConfig.channels.email.smtpServer}:${alertConfig.channels.email.smtpPort}）`;
        toast.success(`已成功发送 ${serverInfo}，请查收收件人邮箱`);
      } else {
        const detail = response.details;
        const msg = response.message || '发送测试邮件失败';
        toast.error(`${msg}${detail ? `：${detail}` : ''}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '发送测试邮件失败';
      toast.error(`发送失败：${msg}。请检查 SMTP 服务器、端口、用户名和授权码是否正确`);
    } finally {
      setSendingEmail(false);
    }
  };

  const testWebhook = async () => {
    if (!alertConfig.channels.webhook.url) {
      toast.warning('请先填写 Webhook 地址');
      return;
    }
    setSendingWebhook(true);
    try {
      const response = await api.post('/api/alerts/test', {
        channel: 'webhook',
        config: alertConfig.channels.webhook,
      });
      if (response.success) {
        toast.success('已成功发送，Webhook 端点已收到测试请求');
      } else {
        const detail = response.details;
        const msg = response.message || 'Webhook 测试请求发送失败';
        toast.error(`${msg}${detail ? `：${detail}` : ''}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Webhook 测试请求失败';
      toast.error(`发送失败：${msg}。请检查 Webhook URL 是否可访问`);
    } finally {
      setSendingWebhook(false);
    }
  };

  return (
    <div className="page">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">⚙️ 系统设置</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? '保存中...' : saved ? '✅ 已保存' : '💾 保存设置'}
        </button>
      </div>

      {/* 标签页 */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'alert' ? 'active' : ''}`}
          onClick={() => setActiveTab('alert')}
        >
          🔔 告警配置
        </button>
        <button
          className={`settings-tab ${activeTab === 'otel' ? 'active' : ''}`}
          onClick={() => setActiveTab('otel')}
        >
          📡 数据采集
        </button>
        <button
          className={`settings-tab ${activeTab === 'ui' ? 'active' : ''}`}
          onClick={() => setActiveTab('ui')}
        >
          🖥️ 界面配置
        </button>
        <button
          className={`settings-tab ${activeTab === 'adapters' ? 'active' : ''}`}
          onClick={() => setActiveTab('adapters')}
        >
          🔌 适配器管理
        </button>
      </div>

      {/* 告警配置 */}
      {activeTab === 'alert' && (
        <div className="settings-content">
          {/* 告警总开关 */}
          <div className="card alert-master-switch">
            <div className="alert-master-content">
              <div>
                <h3>告警通知</h3>
                <p>当系统指标超过阈值时，发送告警通知</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={alertConfig.enabled}
                  onChange={(e) => setAlertConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* 钉钉配置 */}
          <div className="card">
            <div className="channel-header">
              <div className="channel-title">
                <span className="channel-icon">💬</span>
                <div>
                  <h3>钉钉</h3>
                  <p>通过钉钉机器人发送告警消息</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={alertConfig.channels.dingtalk.enabled}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    channels: { ...prev.channels, dingtalk: { ...prev.channels.dingtalk, enabled: e.target.checked } }
                  }))}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {alertConfig.channels.dingtalk.enabled && (
              <div className="channel-config">
                <div className="form-group">
                  <label>Webhook 地址</label>
                  <input
                    type="text"
                    value={alertConfig.channels.dingtalk.webhookUrl}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, dingtalk: { ...prev.channels.dingtalk, webhookUrl: e.target.value } }
                    }))}
                    placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx"
                  />
                  <span className="form-hint">在钉钉群中添加自定义机器人，复制 Webhook 地址</span>
                </div>
                <div className="form-group">
                  <label>加签密钥（可选）</label>
                  <input
                    type="password"
                    value={alertConfig.channels.dingtalk.secret}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, dingtalk: { ...prev.channels.dingtalk, secret: e.target.value } }
                    }))}
                    placeholder="SEC开头的密钥"
                  />
                </div>
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={testDingtalk} disabled={sendingDingtalk}>
                    {sendingDingtalk ? '⏳ 发送中...' : '🧪 发送测试消息'}
                  </button>
                  <button className="btn btn-primary" onClick={saveDingtalkConfig}>
                    💾 保存配置
                  </button>
                  <button className="btn btn-danger" onClick={clearDingtalkConfig}>
                    🗑️ 清空配置
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 邮箱配置 */}
          <div className="card">
            <div className="channel-header">
              <div className="channel-title">
                <span className="channel-icon">📧</span>
                <div>
                  <h3>邮件</h3>
                  <p>通过 SMTP 发送告警邮件</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={alertConfig.channels.email.enabled}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    channels: { ...prev.channels, email: { ...prev.channels.email, enabled: e.target.checked } }
                  }))}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {alertConfig.channels.email.enabled && (
              <div className="channel-config">
                <div className="form-row">
                  <div className="form-group">
                    <label>SMTP 服务器</label>
                    <input
                      type="text"
                      value={alertConfig.channels.email.smtpServer}
                      onChange={(e) => setAlertConfig(prev => ({
                        ...prev,
                        channels: { ...prev.channels, email: { ...prev.channels.email, smtpServer: e.target.value } }
                      }))}
                      placeholder="smtp.gmail.com"
                    />
                  </div>
                  <div className="form-group" style={{ maxWidth: '120px' }}>
                    <label>端口</label>
                    <input
                      type="number"
                      value={alertConfig.channels.email.smtpPort}
                      onChange={(e) => setAlertConfig(prev => ({
                        ...prev,
                        channels: { ...prev.channels, email: { ...prev.channels.email, smtpPort: parseInt(e.target.value) || 587 } }
                      }))}
                      placeholder="587"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>用户名</label>
                  <input
                    type="text"
                    value={alertConfig.channels.email.username}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, email: { ...prev.channels.email, username: e.target.value } }
                    }))}
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div className="form-group">
                  <label>密码 / App 密码</label>
                  <input
                    type="password"
                    value={alertConfig.channels.email.password}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, email: { ...prev.channels.email, password: e.target.value } }
                    }))}
                    placeholder="应用专用密码"
                  />
                  <span className="form-hint">建议使用应用专用密码而非登录密码</span>
                </div>
                <div className="form-group">
                  <label>收件人邮箱</label>
                  <input
                    type="text"
                    value={alertConfig.channels.email.toEmails}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, email: { ...prev.channels.email, toEmails: e.target.value } }
                    }))}
                    placeholder="admin@example.com, oncall@example.com"
                  />
                  <span className="form-hint">多个邮箱用逗号分隔</span>
                </div>
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={testEmail} disabled={sendingEmail}>
                    {sendingEmail ? '⏳ 发送中...' : '🧪 发送测试邮件'}
                  </button>
                  <button className="btn btn-primary" onClick={saveEmailConfig}>
                    💾 保存配置
                  </button>
                  <button className="btn btn-danger" onClick={clearEmailConfig}>
                    🗑️ 清空配置
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Webhook 配置 */}
          <div className="card">
            <div className="channel-header">
              <div className="channel-title">
                <span className="channel-icon">🔗</span>
                <div>
                  <h3>Webhook</h3>
                  <p>向自定义 URL 发送 HTTP POST 请求</p>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={alertConfig.channels.webhook.enabled}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    channels: { ...prev.channels, webhook: { ...prev.channels.webhook, enabled: e.target.checked } }
                  }))}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {alertConfig.channels.webhook.enabled && (
              <div className="channel-config">
                <div className="form-group">
                  <label>Webhook URL</label>
                  <input
                    type="text"
                    value={alertConfig.channels.webhook.url}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, webhook: { ...prev.channels.webhook, url: e.target.value } }
                    }))}
                    placeholder="https://your-webhook-endpoint.com/alert"
                  />
                </div>
                <div className="form-group">
                  <label>密钥（可选）</label>
                  <input
                    type="password"
                    value={alertConfig.channels.webhook.secret}
                    onChange={(e) => setAlertConfig(prev => ({
                      ...prev,
                      channels: { ...prev.channels, webhook: { ...prev.channels.webhook, secret: e.target.value } }
                    }))}
                    placeholder="用于签名验证"
                  />
                </div>
                <div className="button-group">
                  <button className="btn btn-secondary" onClick={testWebhook} disabled={sendingWebhook}>
                    {sendingWebhook ? '⏳ 发送中...' : '🧪 发送测试请求'}
                  </button>
                  <button className="btn btn-primary" onClick={saveWebhookConfig}>
                    💾 保存配置
                  </button>
                  <button className="btn btn-danger" onClick={clearWebhookConfig}>
                    🗑️ 清空配置
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 告警阈值 */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>⚠️ 告警阈值</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Token 消耗阈值</label>
                <input
                  type="number"
                  value={alertConfig.rules.tokenThreshold}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    rules: { ...prev.rules, tokenThreshold: parseInt(e.target.value) || 0 }
                  }))}
                />
                <span className="form-hint">日 Token 消耗超过此值时告警</span>
              </div>
              <div className="form-group">
                <label>错误率阈值 (%)</label>
                <input
                  type="number"
                  value={alertConfig.rules.errorRateThreshold}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    rules: { ...prev.rules, errorRateThreshold: parseFloat(e.target.value) || 0 }
                  }))}
                />
                <span className="form-hint">错误率超过此百分比时告警</span>
              </div>
              <div className="form-group">
                <label>延迟阈值 (ms)</label>
                <input
                  type="number"
                  value={alertConfig.rules.latencyThreshold}
                  onChange={(e) => setAlertConfig(prev => ({
                    ...prev,
                    rules: { ...prev.rules, latencyThreshold: parseInt(e.target.value) || 0 }
                  }))}
                />
                <span className="form-hint">平均延迟超过此值时告警</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OpenTelemetry 配置 */}
      {activeTab === 'otel' && (
        <div className="settings-content">
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>📡 OpenTelemetry 数据采集配置</h3>

            <div className="form-group">
              <label>OTEL 端点</label>
              <input
                type="text"
                value={otelConfig.endpoint}
                onChange={(e) => setOtelConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                placeholder="http://localhost:4318"
              />
              <span className="form-hint">OpenTelemetry Collector 的 gRPC 或 HTTP 端点</span>
            </div>

            <div className="form-group">
              <label>服务名称</label>
              <input
                type="text"
                value={otelConfig.serviceName}
                onChange={(e) => setOtelConfig(prev => ({ ...prev, serviceName: e.target.value }))}
                placeholder="zhixu-server"
              />
            </div>

            <button className="btn btn-secondary" onClick={testConnection}>
              🔗 测试连接
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>📝 配置说明</h3>
            <div className="config-info">
              <p><strong>OTEL 端点：</strong>数据采集器地址，用于接收来自 AI 编程工具的追踪数据</p>
              <p><strong>服务名称：</strong>在监控系统中的标识名称，便于区分不同服务</p>
            </div>
          </div>
        </div>
      )}

      {/* 界面配置 */}
      {activeTab === 'ui' && (
        <div className="settings-content">
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem' }}>🖥️ 界面显示配置</h3>

            <div className="form-group">
              <label>数据刷新间隔（秒）</label>
              <input
                type="number"
                value={uiConfig.refreshInterval}
                onChange={(e) => setUiConfig(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 30 }))}
                min={10}
                max={300}
              />
              <span className="form-hint">建议值：10-300秒，值越小刷新越频繁</span>
            </div>

            <div className="form-group">
              <label>界面主题</label>
              <select
                value={uiConfig.theme}
                onChange={(e) => {
                  const newTheme = e.target.value as 'dark' | 'light';
                  // 1. 更新 state → 触发 applyTheme 的 useEffect，立即应用到 DOM
                  setUiConfig(prev => ({ ...prev, theme: newTheme }));
                  // 2. 立即写入 localStorage，避免导航后恢复到旧值
                  try {
                    const existing = localStorage.getItem('zhixu-ui-config');
                    const merged = existing ? JSON.parse(existing) : { refreshInterval: 30 };
                    localStorage.setItem('zhixu-ui-config', JSON.stringify({ ...merged, theme: newTheme }));
                  } catch (error) {
                    console.error('[Settings] 主题持久化失败', error);
                  }
                }}
              >
                <option value="dark">深色主题（科技风）</option>
                <option value="light">浅色主题</option>
              </select>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>ℹ️ 关于</h3>
            <div className="about-info">
              <div className="about-row">
                <span>版本</span>
                <span>1.0.0</span>
              </div>
              <div className="about-row">
                <span>构建日期</span>
                <span>2026-06-15</span>
              </div>
              <div className="about-row">
                <span>许可证</span>
                <span>Apache License 2.0</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                知墟 (ZhiXu ACOP) 是一个统一的 AI 编程助手观测与优化平台，
                支持 Trae、Claude Code、Cursor 等工具的数据采集、监控和自动优化。
              </p>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'adapters' && (
        <div className="settings-content">
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>🔌 适配器状态</h3>
            <p className="form-hint" style={{ marginBottom: '1.5rem' }}>
              自动模式会扫描你本地的 AI 编程工具日志目录，采集真实事件数据；手动模式需要通过 API 主动提交。
            </p>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={loadAdapters} disabled={adapterLoading}>
                {adapterLoading ? '🔄 刷新中...' : '🔄 刷新状态'}
              </button>
              <button className="btn btn-secondary" onClick={triggerCollect} disabled={collecting}>
                {collecting ? '采集中...' : '▶️ 立即采集'}
              </button>
              {lastCollectResult !== null && (
                <span className="form-hint" style={{ alignSelf: 'center' }}>
                  本次采集 {lastCollectResult} 条事件
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {adapters.map((a) => (
                <div key={a.toolType} className="alert-channel-card" style={{ padding: '1rem' }}>
                  <div className="alert-channel-header">
                    <div>
                      <h4 style={{ margin: 0, marginBottom: '0.25rem' }}>
                        {a.toolType === 'trae' ? '🔷 ' : a.toolType === 'claude_code' ? '🟣 ' : '🟢 '}
                        {a.name}
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>v{a.version}</span>
                      </h4>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        总采集: {a.totalCollected} 条 | token: {(a.metrics.totalTokens / 1000).toFixed(1)}k | 平均延迟: {Math.round(a.metrics.avgLatency)}ms
                      </div>
                    </div>
                    <span className={`badge ${a.enabled ? 'badge-active' : 'badge-inactive'}`}>
                      {a.enabled ? `● ${a.mode}` : '○ 已禁用'}
                    </span>
                  </div>

                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div><span style={{ color: 'var(--text-secondary)' }}>健康状态：</span>
                      <span style={{ color: a.health.status === 'healthy' ? 'var(--success-color)' : a.health.status === 'degraded' ? '#f39c12' : 'var(--danger-color)' }}>
                        {a.health.status === 'healthy' ? '✅ 正常' : a.health.status === 'degraded' ? '⚠️ 降级' : '❌ 异常'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>扫描目录：</span>
                      {a.detectedPath ? (
                        <code style={{ fontSize: '0.8rem' }}>{a.detectedPath}</code>
                      ) : (
                        <span style={{ color: 'var(--warning-color)', fontWeight: 600 }}>未找到 ⚠️</span>
                      )}
                    </div>
                    {a.lastError && (
                      <div style={{ gridColumn: 'span 2', color: 'var(--warning-color)' }}>
                        错误: {a.lastError}
                      </div>
                    )}
                    {a.health.error && !a.lastError && (
                      <div style={{ gridColumn: 'span 2', color: 'var(--warning-color)' }}>
                        {a.health.error}
                      </div>
                    )}
                  </div>

                  {/* 未找到目录时的提示 + 候选路径 + 手动输入 */}
                  {!a.detectedPath && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(243, 156, 18, 0.08)', border: '1px dashed rgba(243, 156, 18, 0.4)', borderRadius: '4px' }}>
                      <div style={{ color: 'var(--warning-color)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        ⚠️ 未检测到可用日志目录。请确认以下默认路径是否存在，或在下方手动指定你的实际安装目录：
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        <div style={{ marginBottom: '0.25rem' }}>常见默认路径示例：</div>
                        {(a.candidatePaths || []).slice(0, 5).map((p, i) => (
                          <div key={i} style={{ paddingLeft: '0.5rem', fontFamily: 'monospace', opacity: 0.9 }}>
                            • {p}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder={`例如：D:/Trae/User/trae 或 D:/Tools/Cursor/logs`}
                          value={manualPathMap[a.toolType] || ''}
                          onChange={(e) => setManualPathMap({ ...manualPathMap, [a.toolType]: e.target.value })}
                          style={{ flex: 1, padding: '0.45rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '0.85rem' }}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                          onClick={() => applyManualPath(a.toolType, manualPathMap[a.toolType] || '')}
                        >
                          确认目录
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 已设置目录：显示变更入口 */}
                  {a.detectedPath && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <button
                        className="btn btn-text"
                        style={{ padding: 0, fontSize: '0.8rem' }}
                        onClick={() => {
                          setManualPathMap({ ...manualPathMap, [a.toolType]: a.detectedPath || '' });
                        }}
                      >
                        🔧 修改目录路径
                      </button>
                      {manualPathMap[a.toolType] && manualPathMap[a.toolType] !== '' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="新的目录路径"
                            value={manualPathMap[a.toolType]}
                            onChange={(e) => setManualPathMap({ ...manualPathMap, [a.toolType]: e.target.value })}
                            style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '0.8rem' }}
                          />
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            onClick={() => applyManualPath(a.toolType, manualPathMap[a.toolType])}
                          >
                            确认
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 手动模式：事件提交表单 */}
                  {a.mode === 'manual' && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(52, 152, 219, 0.08)', border: '1px dashed rgba(52, 152, 219, 0.4)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>📡 手动模式 — 提交自定义事件数据</div>
                        <button
                          className="btn btn-text"
                          style={{ padding: 0, fontSize: '0.8rem' }}
                          onClick={() => setManualEventExpanded({ ...manualEventExpanded, [a.toolType]: !manualEventExpanded[a.toolType] })}
                        >
                          {manualEventExpanded[a.toolType] ? '收起' : '展开表单'}
                        </button>
                      </div>
                      {manualEventExpanded[a.toolType] && (
                        <div>
                          <textarea
                            placeholder={`{ "sessionId": "session-xxx", "modelId": "claude-sonnet-4", "tokenConsumption": { "input": 500, "output": 1200 }, "performance": { "latency": 1500, "ttft": 300 } }`}
                            value={manualEventJson[a.toolType] || ''}
                            onChange={(e) => setManualEventJson({ ...manualEventJson, [a.toolType]: e.target.value })}
                            style={{ width: '100%', minHeight: '100px', padding: '0.5rem', borderRadius: '4px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', fontSize: '0.8rem', fontFamily: 'monospace', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              onClick={() => submitCustomEvent(a.toolType, manualEventJson[a.toolType] || '')}
                            >
                              提交事件
                            </button>
                            <button
                              className="btn btn-text"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              onClick={() => submitTestEvent(a.toolType)}
                            >
                              插入测试事件
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <input
                        type="checkbox"
                        checked={a.enabled}
                        onChange={async (e) => {
                          await api.post(`/api/adapters/${a.toolType}/config`, { enabled: e.target.checked });
                          loadAdapters();
                        }}
                      />
                      启用
                    </label>
                    <select
                      value={a.mode}
                      onChange={async (e) => {
                        await api.post(`/api/adapters/${a.toolType}/config`, { mode: e.target.value as 'manual' | 'auto' });
                        loadAdapters();
                      }}
                      style={{ padding: '0.4rem', borderRadius: '4px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
                    >
                      <option value="auto">自动模式（扫描日志）</option>
                      <option value="manual">手动模式（API 提交）</option>
                    </select>
                    {a.mode !== 'manual' && (
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }} onClick={() => submitTestEvent(a.toolType)}>
                        ➕ 插入测试事件
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {adapters.length === 0 && !adapterLoading && (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  无适配器信息，请点击「刷新状态」
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default Settings;
