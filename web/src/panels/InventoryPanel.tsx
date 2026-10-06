import { useState } from 'react';
import { api } from '../api';
import { OldBattery } from '../types';
import { Banner, Field, StatusTag } from '../components/ui';

export default function InventoryPanel({
  batteries,
  onChanged,
}: {
  batteries: OldBattery[];
  onChanged: () => void;
}) {
  const [reweighSerial, setReweighSerial] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState('');
  const [operator, setOperator] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const current = batteries.find((b) => b.serialNumber === reweighSerial);

  async function submitReweigh(e: React.FormEvent) {
    e.preventDefault();
    if (!reweighSerial) return;
    setError('');
    setOk('');
    try {
      await api.reweigh(reweighSerial, {
        newWeightKg: Number(newWeight),
        operator,
        reason,
      });
      setOk(`复称已保存：原重量保留，当前重量更新为 ${Number(newWeight)} kg`);
      setReweighSerial(null);
      setNewWeight('');
      setOperator('');
      setReason('');
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel-card">
      <h2>③ 库存暂存与复称</h2>
      <p className="muted">
        复称会同时保留<strong>原重量</strong>与<strong>新测量值</strong>（见每件的复称历史）。
      </p>

      {reweighSerial && current && (
        <form className="inline-form" onSubmit={submitReweigh}>
          <h4>复称：{reweighSerial}</h4>
          <p className="muted">原重量：{current.weightKg} kg（保存后仍可在历史中查看）</p>
          <div className="grid-3">
            <Field label="新测量重量 (kg) *">
              <input className="input" type="number" step="0.001" min="0.001" required value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
            </Field>
            <Field label="复称经手人 *">
              <input className="input" required value={operator} onChange={(e) => setOperator(e.target.value)} />
            </Field>
            <Field label="原因">
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如 例行复称" />
            </Field>
          </div>
          {error && <Banner kind="err">⛔ {error}</Banner>}
          <div className="row-gap">
            <button className="btn-primary" type="submit">保存复称记录</button>
            <button type="button" className="btn-ghost" onClick={() => setReweighSerial(null)}>取消</button>
          </div>
        </form>
      )}
      {ok && <Banner kind="ok">✅ {ok}</Banner>}

      <table className="table">
        <thead>
          <tr>
            <th>旧件编号</th>
            <th>车牌 / 车主</th>
            <th>当前重量</th>
            <th>状态</th>
            <th>入库时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {batteries.map((b) => (
            <tr key={b.id}>
              <td className="mono">{b.serialNumber}</td>
              <td>{b.vehiclePlate}<br /><span className="muted">{b.customerName ?? '—'}</span></td>
              <td>
                {b.weightKg} kg
                {b.weightRecords && b.weightRecords.length > 0 && (
                  <div className="muted small">
                    复称 {b.weightRecords.length} 次 · 原值 {b.weightRecords[0].previousWeightKg}kg
                  </div>
                )}
              </td>
              <td><StatusTag status={b.status} /></td>
              <td className="muted">{new Date(b.createdAt).toLocaleString('zh-CN')}</td>
              <td>
                <button className="btn-link" onClick={() => { setOk(''); setError(''); setReweighSerial(b.serialNumber); setNewWeight(String(b.weightKg)); }}>
                  复称
                </button>
              </td>
            </tr>
          ))}
          {batteries.length === 0 && (
            <tr><td colSpan={6} className="muted center">暂无旧件</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
