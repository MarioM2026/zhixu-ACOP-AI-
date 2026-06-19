import { useState, useEffect } from 'react';
import { api } from '../services/api';

const STRATEGY_LABELS: Record<string, { name: string; color: string }> = {
  cost_optimized: { name: '成本优先', color: '#10b981' },
  speed_optimized: { name: '速度优先', color: '#3b82f6' },
  quality_optimized: { name: '质量优先', color: '#8b5cf6' },
  balanced: { name: '均衡策略', color: '#f59e0b' },
  custom: { name: '自定义', color: '#6b7280' },
};

const TASK_TYPE_LABELS: Record<string, string> = {
  bug_fix: 'Bug 修复', debugging: '调试诊断', code_review: '代码审查',
  refactoring: '重构优化', code_completion: '代码补全', code_generation: '代码生成',
  explanation: '代码解释', documentation: '文档生成', testing: '测试生成',
  optimization: '性能优化', security_review: '安全审查', architecture: '架构设计',
  migration: '代码迁移', general: '通用对话',
};

const CAPABILITY_KEYS = [
  'codeCompletion', 'codeReview', 'bugFix', 'refactoring', 'codeGeneration',
  'explanation', 'documentation', 'testing', 'debugging', 'securityReview', 'architecture',
];

const CAPABILITY_LABELS: Record<string, string> = {
  codeCompletion: '代码补全', codeReview: '代码审查', bugFix: 'Bug修复',
  refactoring: '重构', codeGeneration: '代码生成', explanation: '代码解释',
  documentation: '文档生成', testing: '测试', debugging: '调试',
  securityReview: '安全审查', architecture: '架构',
};

interface ModelProfile {
  modelId: string; displayName: string; provider: string; enabled: boolean;
  tags: string[]; capabilities: Record<string, number>;
  costPerMillionInput: number; costPerMillionOutput: number;
  avgLatency: number; maxTokens: number; contextWindow: number;
}

interface RoutingRule {
  id: string; name: string; description: string; enabled: boolean;
  conditions: { taskTypes: string[] }; strategy: string;
  forceModel?: string; excludeModels?: string[]; priority: number;
}

interface RoutingStats {
  totalDecisions: number; modelUsage: Record<string, number>;
  taskTypeDistribution: Record<string, number>;
  avgLatencyByModel: Record<string, number>;
  strategyUsage: Record<string, number>;
}

interface SimResult {
  taskType: string; taskTypeName: string; confidence: number;
  candidates: Array<{ modelId: string; totalScore: number; costScore: number; speedScore: number; capabilityScore: number; reason: string }>;
  topPick: { modelId: string; totalScore: number; reason: string };
}

function ModelRouting() {
  const [activeTab, setActiveTab] = useState<'simulate' | 'models' | 'rules' | 'stats'>('simulate');
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [stats, setStats] = useState<RoutingStats | null>(null);
  const [loading, setLoading] = useState(false);

  // 模拟输入
  const [simInput, setSimInput] = useState('请帮我审查这段代码，看看有没有安全漏洞');
  const [simStrategy, setSimStrategy] = useState<string>('balanced');
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  // 模型详情
  const [selectedModel, setSelectedModel] = useState<ModelProfile | null>(null);

  // 规则编辑
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [showRuleModal, setShowRuleModal] = useState(false);

  // 路由模拟
  async function runSimulate() {
    if (!simInput.trim()) return;
    setSimRunning(true);
    try {
      const r = await api.post<SimResult>('/api/router/simulate', { input: simInput, strategy: simStrategy });
      if (r.success && r.data) setSimResult(r.data);
    } catch { } finally { setSimRunning(false); }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [modelsR, rulesR, statsR] = await Promise.all([
        api.get<ModelProfile[]>('/api/router/models'),
        api.get<RoutingRule[]>('/api/router/rules'),
        api.get<RoutingStats>('/api/router/stats'),
      ]);
      if (modelsR.success) setModels(modelsR.data || []);
      if (rulesR.success) setRules(rulesR.data || []);
      if (statsR.success) setStats(statsR.data || null);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function toggleModel(modelId: string, enabled: boolean) {
    await api.put(`/api/router/models/${modelId}`, { enabled });
    loadAll();
  }

  async function toggleRule(id: string, enabled: boolean) {
    await api.put(`/api/router/rules/${id}`, { enabled });
    loadAll();
  }

  async function saveRule(rule: Partial<RoutingRule>) {
    if (rule.id) {
      await api.put(`/api/router/rules/${rule.id}`, rule);
    } else {
      await api.post('/api/router/rules', rule);
    }
    setShowRuleModal(false);
    setEditingRule(null);
    loadAll();
  }

  async function deleteRule(id: string) {
    if (!confirm('确定要删除这条规则吗？')) return;
    await api.delete(`/api/router/rules/${id}`);
    loadAll();
  }

  const providerColors: Record<string, string> = {
    anthropic: '#e67e22', openai: '#27ae60', deepseek: '#2980b9',
    qwen: '#8e44ad', google: '#c0392b', custom: '#7f8c8d',
  };

  const enabledModels = models.filter(m => m.enabled);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🧭 模型路由优化</h1>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          根据任务类型自动选择最优模型，降低成本提升效率
        </span>
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {(['simulate', 'models', 'rules', 'stats'] as const).map(tab => (
          <button key={tab} className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'simulate' ? '🎯 路由模拟' : tab === 'models' ? '🤖 模型画像' : tab === 'rules' ? '📋 路由规则' : '📊 统计概览'}
          </button>
        ))}
      </div>

      {/* 路由模拟 */}
      {activeTab === 'simulate' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>🎯 输入任务描述</h3>
            <textarea
              value={simInput}
              onChange={e => setSimInput(e.target.value)}
              style={{
                width: '100%', minHeight: 120, padding: '0.75rem', borderRadius: 8,
                background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                color: 'var(--text-color)', fontSize: '0.9rem', marginBottom: '1rem',
                resize: 'vertical', fontFamily: 'inherit',
              }}
              placeholder="输入任务描述，如：帮我修复这个 Bug / 审查代码安全性 / 优化这段代码性能"
            />
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>路由策略</label>
              <select value={simStrategy} onChange={e => setSimStrategy(e.target.value)}>
                <option value="balanced">均衡策略</option>
                <option value="cost_optimized">成本优先（最低成本模型）</option>
                <option value="speed_optimized">速度优先（最快响应）</option>
                <option value="quality_optimized">质量优先（最强能力）</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={runSimulate} disabled={simRunning || !simInput.trim()}>
              {simRunning ? '分析中...' : '🔍 执行路由分析'}
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>📊 路由决策结果</h3>
            {simResult ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem', borderRadius: 12, fontSize: '0.8rem',
                    background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                  }}>
                    {simResult.taskTypeName}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    置信度 {(simResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div style={{
                  padding: '1rem', borderRadius: 10, marginBottom: '1rem',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1))',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    推荐模型
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.25rem' }}>
                    {simResult.topPick.modelId}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {simResult.topPick.reason}（综合评分 {simResult.topPick.totalScore}）
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  候选模型排行
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {simResult.candidates.map((c, i) => (
                    <div key={c.modelId} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem', borderRadius: 6,
                      background: i === 0 ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      border: `1px solid ${i === 0 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                    }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: '50%', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: i === 0 ? '#10b981' : i === 1 ? '#6b7280' : '#374151',
                        color: '#fff',
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: '0.85rem' }}>{c.modelId}</span>
                      <span style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{c.totalScore}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#10b981' }}>💰{c.costScore}</span>
                        <span style={{ color: '#3b82f6' }}>⚡{c.speedScore}</span>
                        <span style={{ color: '#8b5cf6' }}>🎯{c.capabilityScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                输入任务描述后点击「执行路由分析」
              </div>
            )}
          </div>
        </div>
      )}

      {/* 模型画像 */}
      {activeTab === 'models' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🤖 模型能力对比</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>模型</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>提供商</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-secondary)' }}>状态</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-secondary)' }}>输入成本</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-secondary)' }}>输出成本</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--text-secondary)' }}>延迟</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--text-secondary)' }}>标签</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map(m => (
                    <tr key={m.modelId} style={{ borderBottom: '1px solid var(--border-color)' }}
                      onClick={() => setSelectedModel(selectedModel?.modelId === m.modelId ? null : m)}
                      className={selectedModel?.modelId === m.modelId ? 'selected' : ''}
                    >
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{m.displayName}</td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{ color: providerColors[m.provider] || '#888', fontSize: '0.8rem' }}>
                          {m.provider.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" checked={m.enabled}
                            onChange={e => { e.stopPropagation(); toggleModel(m.modelId, e.target.checked); }}
                          />
                        </label>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: '#10b981' }}>
                        ${m.costPerMillionInput}/M
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', color: '#f59e0b' }}>
                        ${m.costPerMillionOutput}/M
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{m.avgLatency}ms</td>
                      <td style={{ padding: '0.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {m.tags.map(t => (
                            <span key={t} style={{
                              padding: '0.1rem 0.5rem', borderRadius: 10, fontSize: '0.75rem',
                              background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
                            }}>{t}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 选中模型的能力雷达图（简化表格形式） */}
          {selectedModel && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>
                🎯 {selectedModel.displayName} 能力雷达
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {CAPABILITY_KEYS.map(key => {
                  const val = selectedModel.capabilities[key] || 0;
                  const pct = val * 10;
                  return (
                    <div key={key} style={{ padding: '0.75rem', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {CAPABILITY_LABELS[key]}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#10b981' : pct > 60 ? '#f59e0b' : '#6b7280', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 20 }}>{val}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 路由规则 */}
      {activeTab === 'rules' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>📋 路由规则列表</h3>
            <button className="btn btn-primary" onClick={() => { setEditingRule(null); setShowRuleModal(true); }}>
              + 新增规则
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {rules.map(rule => (
              <div key={rule.id} style={{
                padding: '1rem', borderRadius: 10, border: '1px solid var(--border-color)',
                background: rule.enabled ? 'var(--bg-secondary)' : 'rgba(107, 114, 128, 0.05)',
                opacity: rule.enabled ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{rule.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rule.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: 10, fontSize: '0.75rem',
                      background: `${STRATEGY_LABELS[rule.strategy]?.color}22`,
                      color: STRATEGY_LABELS[rule.strategy]?.color,
                    }}>
                      {STRATEGY_LABELS[rule.strategy]?.name}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>优先级 {rule.priority}</span>
                    <input type="checkbox" checked={rule.enabled}
                      onChange={e => toggleRule(rule.id, e.target.checked)} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {rule.conditions.taskTypes.map(t => (
                    <span key={t} style={{
                      padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                    }}>
                      {TASK_TYPE_LABELS[t] || t}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={() => { setEditingRule(rule); setShowRuleModal(true); }}>编辑</button>
                  <button className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger-color)' }}
                    onClick={() => deleteRule(rule.id)}>删除</button>
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                暂无路由规则
              </div>
            )}
          </div>
        </div>
      )}

      {/* 统计概览 */}
      {activeTab === 'stats' && stats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: '总路由决策', value: stats.totalDecisions, color: '#8b5cf6' },
              { label: '活跃模型数', value: Object.keys(stats.modelUsage).length, color: '#3b82f6' },
              { label: '任务类型数', value: Object.keys(stats.taskTypeDistribution).length, color: '#10b981' },
              { label: '策略种类', value: Object.keys(stats.strategyUsage).length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card">
              <h4 style={{ marginBottom: '1rem' }}>🤖 模型使用分布</h4>
              {Object.entries(stats.modelUsage).sort((a, b) => b[1] - a[1]).map(([modelId, count]) => {
                const pct = Math.round((count / stats.totalDecisions) * 100);
                return (
                  <div key={modelId} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span>{modelId}</span><span style={{ color: '#8b5cf6' }}>{count}次 ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#8b5cf6', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card">
              <h4 style={{ marginBottom: '1rem' }}>📂 任务类型分布</h4>
              {Object.entries(stats.taskTypeDistribution).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const pct = Math.round((count / stats.totalDecisions) * 100);
                return (
                  <div key={type} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span>{TASK_TYPE_LABELS[type] || type}</span><span style={{ color: '#10b981' }}>{count}次 ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#10b981', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 规则编辑弹窗 */}
      {showRuleModal && (
        <RuleEditModal
          rule={editingRule}
          onSave={saveRule}
          onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
        />
      )}
    </div>
  );
}

function RuleEditModal({ rule, onSave, onClose }: {
  rule: RoutingRule | null;
  onSave: (r: Partial<RoutingRule>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [strategy, setStrategy] = useState(rule?.strategy || 'balanced');
  const [priority, setPriority] = useState(rule?.priority || 5);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(rule?.conditions?.taskTypes || []);

  function toggleType(t: string) {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--card-bg)', borderRadius: 16, padding: '2rem', width: 520,
        maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-color)',
      }}>
        <h3 style={{ marginBottom: '1.5rem' }}>{rule ? '编辑路由规则' : '新建路由规则'}</h3>
        <div className="form-group">
          <label>规则名称</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="如：Bug修复质量优先" />
        </div>
        <div className="form-group">
          <label>描述</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="描述规则的用途" />
        </div>
        <div className="form-group">
          <label>路由策略</label>
          <select value={strategy} onChange={e => setStrategy(e.target.value)}>
            <option value="balanced">均衡策略</option>
            <option value="cost_optimized">成本优先</option>
            <option value="speed_optimized">速度优先</option>
            <option value="quality_optimized">质量优先</option>
            <option value="custom">自定义</option>
          </select>
        </div>
        <div className="form-group">
          <label>优先级（数字越大越优先）</label>
          <input type="number" value={priority} min={1} max={100}
            onChange={e => setPriority(parseInt(e.target.value) || 1)} />
        </div>
        <div className="form-group">
          <label>适用任务类型</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {Object.entries(TASK_TYPE_LABELS).map(([id, label]) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={selectedTypes.includes(id)}
                  onChange={() => toggleType(id)} />
                <span style={{ fontSize: '0.85rem' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => {
            if (!name || selectedTypes.length === 0) return alert('请填写名称并选择至少一个任务类型');
            onSave({
              ...(rule?.id ? { id: rule.id } : {}),
              name, description, strategy, priority,
              enabled: rule?.enabled ?? true,
              conditions: { taskTypes: selectedTypes },
            });
          }}>保存</button>
        </div>
      </div>
    </div>
  );
}

export default ModelRouting;
