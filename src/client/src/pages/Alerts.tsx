import { useState, useEffect } from 'react';
import { useToast, createToastApi, ToastContainer } from '../hooks/useToast';

interface Alert {
  id: string;
  ruleId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  metadata?: {
    tokenUsage?: string;
    errorRate?: string;
    avgLatency?: string;
    requestCount?: string;
  };
}

const SEVERITY_CONFIG: Record<Alert['severity'], { label: string; color: string; bgColor: string; borderColor: string }> = {
  info: { label: '提示', color: 'var(--info-color, #3b82f6)', bgColor: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.3)' },
  warning: { label: '警告', color: 'var(--warning-color, #f59e0b)', bgColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' },
  error: { label: '错误', color: 'var(--danger-color, #ef4444)', bgColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' },
  critical: { label: '严重', color: 'var(--critical-color, #b91c1c)', bgColor: 'rgba(185, 28, 28, 0.08)', borderColor: 'rgba(185, 28, 28, 0.3)' },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
  return Math.floor(diff / 86400000) + ' 天前';
}

const FILTER_LABELS: Record<string, string> = {
  all: '全部',
  unack: '未处理',
  ack: '已处理',
  critical: '严重',
  warning: '警告',
  info: '提示',
};

function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'unack' | 'ack' | 'critical' | 'warning' | 'info'>('all');
  const [error, setError] = useState<string | null>(null);
  const { toasts, showToast, removeToast: removeToastFn } = useToast();
  const toast = createToastApi(showToast);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/alerts');
      if (!response.ok) throw new Error('加载告警列表失败');
      const data = await response.json();
      if (data.success) {
        setAlerts(data.data || []);
      } else {
        throw new Error(data.message || '加载失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledgeAll() {
    try {
      const response = await fetch('/api/alerts/ack-all', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || '已确认所有告警');
        // 先切换视图再刷新数据，确保 UI 立即响应
        setFilter('all');
        await loadAlerts();
      }
    } catch {
      toast.error('批量确认告警失败');
    }
  }

  async function handleAcknowledge(id: string) {
    try {
      const response = await fetch('/api/alerts/' + id + '/ack', {
        method: 'POST',
      });
      if (response.ok) {
        setAlerts(function(prev) {
          return prev.map(function(a) {
            return a.id === id ? Object.assign({}, a, { acknowledged: true }) : a;
          });
        });
      }
    } catch {
      setError('确认告警失败');
    }
  }

  useEffect(function() {
    loadAlerts();
  }, []);

  const unackCount = alerts.filter(function(a) { return !a.acknowledged; }).length;
  const criticalCount = alerts.filter(function(a) { return a.severity === 'critical' && !a.acknowledged; }).length;
  const warningCount = alerts.filter(function(a) { return a.severity === 'warning' && !a.acknowledged; }).length;

  const filteredAlerts = alerts.filter(function(a) {
    if (filter === 'all') return true;
    if (filter === 'unack') return !a.acknowledged;
    if (filter === 'ack') return a.acknowledged;
    return a.severity === filter;
  });

  function renderContent() {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>加载中...</div>
      );
    }
    if (filteredAlerts.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>暂无告警记录</div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredAlerts.map(function(alert) {
          const config = SEVERITY_CONFIG[alert.severity];
          return (
            <div
              key={alert.id}
              style={{
                background: alert.acknowledged ? 'var(--bg-card)' : config.bgColor,
                border: '1px solid',
                borderColor: alert.acknowledged ? 'var(--border-color)' : config.borderColor,
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                opacity: alert.acknowledged ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ background: alert.acknowledged ? 'var(--border-color)' : config.color, color: '#fff', fontSize: '0.7rem', padding: '0.125rem 0.375rem', borderRadius: '4px', fontWeight: 600 }}>
                      {config.label}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{alert.title}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>· {alert.ruleId}</span>
                    {!alert.acknowledged && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '2px 8px', background: 'rgba(255, 107, 53, 0.15)', color: '#ff6b35', border: '1px solid rgba(255, 107, 53, 0.4)', borderRadius: '4px', fontWeight: 600 }}>
                        待处理
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0', lineHeight: 1.5 }}>{alert.message}</p>
                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {alert.metadata.tokenUsage !== undefined && (
                        <span>Token: {alert.metadata.tokenUsage}</span>
                      )}
                      {alert.metadata.errorRate !== undefined && (
                        <span>错误率: {alert.metadata.errorRate}%</span>
                      )}
                      {alert.metadata.avgLatency !== undefined && (
                        <span>平均延迟: {Number(alert.metadata.avgLatency).toFixed(0)} ms</span>
                      )}
                      {alert.metadata.requestCount !== undefined && (
                        <span>请求数: {alert.metadata.requestCount}</span>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                    {formatRelative(alert.timestamp)} · {formatTime(alert.timestamp)}
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={function() { handleAcknowledge(alert.id); }}
                    style={{ padding: '0.375rem 0.75rem', border: '1px solid var(--accent-color, #00f5ff)', borderRadius: '4px', background: 'rgba(0, 245, 255, 0.08)', color: 'var(--accent-color, #00f5ff)', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600 }}
                  >
                    ✓ 确认处理
                  </button>
                )}
                {alert.acknowledged && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--success-color, #10b981)', whiteSpace: 'nowrap', fontWeight: 500, padding: '0.375rem 0.75rem', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.08)' }}>
                    ✓ 已确认
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>🔔 告警历史</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            共 {alerts.length} 条告警 · 未处理 {unackCount} 条 · 已确认 {alerts.length - unackCount} 条
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {unackCount > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              style={{ padding: '0.5rem 1rem', border: '1px solid rgba(0, 245, 255, 0.5)', borderRadius: '6px', background: 'rgba(0, 245, 255, 0.08)', color: '#00f5ff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            >
              ✓ 一键处理 ({unackCount})
            </button>
          )}
          <button
            onClick={loadAlerts}
            style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            🔄 刷新
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem', flex: 1, minWidth: '180px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--critical-color, #b91c1c)' }}>{criticalCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>严重告警（未处理）</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem', flex: 1, minWidth: '180px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning-color, #f59e0b)' }}>{warningCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>警告告警（未处理）</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem', flex: 1, minWidth: '180px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--info-color, #3b82f6)' }}>{unackCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>未处理总数</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem', flex: 1, minWidth: '180px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success-color, #10b981)' }}>{alerts.length - unackCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>已确认</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem', flex: 1, minWidth: '180px' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{alerts.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>总告警数</div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {['all', 'unack', 'ack', 'critical', 'warning', 'info'].map(function(f) {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={function() { setFilter(f as any); }}
              style={{
                padding: '0.375rem 0.75rem',
                border: isActive ? '1px solid var(--accent-color, #3b82f6)' : '1px solid var(--border-color)',
                borderRadius: '6px',
                background: isActive ? 'var(--accent-color, #3b82f6)' : 'var(--bg-card)',
                color: isActive ? '#fff' : 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div>
        {renderContent()}
      </div>

      {/* Toast 通知 */}
      <ToastContainer toasts={toasts} onRemove={removeToastFn} />
    </div>
  );
}

export default AlertsPage;
