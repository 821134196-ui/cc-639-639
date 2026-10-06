import { FormEvent, useEffect, useState } from 'react';
import { api, Intake } from '../api';
import { Badge, INTAKE_STATUS, fmtKg, fmtTime } from '../ui';

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'STORED', label: '暂存中' },
  { key: 'SHIPPED', label: '已发回收商' },
  { key: 'RECEIVED', label: '回收商已实收' },
  { key: 'DISPUTED', label: '待核实' },
];

export default function InventoryPage() {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<Intake[]>([]);
  const [error, setError] = useState('');
  const [reweighing, setReweighing] = useState<Intake | null>(null);

  async function reload(s = status) {
    try {
      setItems(await api.listIntakes(s || undefined));
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    reload(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="page">
      <h1>暂存库存</h1>
      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.key} className={`tab ${status === f.key ? 'active' : ''}`} onClick={() => setStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {error && <div className="alert alert-red">{error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>旧件编号</th>
              <th>车牌</th>
              <th>车主</th>
              <th>初始重量</th>
              <th>当前重量</th>
              <th>状态</th>
              <th>凭证号</th>
              <th>入库时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="mono">{i.serialNo}</td>
                <td>{i.vehiclePlate}</td>
                <td>{i.ownerName}</td>
                <td>{fmtKg(i.initialWeightKg)}</td>
                <td>
                  {fmtKg(i.currentWeightKg)}
                  {i.currentWeightKg !== i.initialWeightKg && <span className="muted">（复称）</span>}
                </td>
                <td>
                  <Badge map={INTAKE_STATUS} value={i.status} />
                </td>
                <td className="mono">{i.voucher?.voucherNo ?? '—'}</td>
                <td>{fmtTime(i.createdAt)}</td>
                <td>
                  <button className="btn small" onClick={() => setReweighing(i)}>
                    复称
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  暂无记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {reweighing && (
        <ReweighModal
          intake={reweighing}
          onClose={() => setReweighing(null)}
          onDone={() => {
            setReweighing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function ReweighModal({ intake, onClose, onDone }: { intake: Intake; onClose: () => void; onDone: () => void }) {
  const [weight, setWeight] = useState(String(intake.currentWeightKg));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.reweigh(intake.id, { newWeightKg: Number(weight), reason: reason.trim() || undefined });
      onDone();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>复称：{intake.serialNo}</h3>
        <p className="hint">复称会保留原重量与新测量值，历史可随时沿编号追溯。</p>
        <form className="form" onSubmit={submit}>
          <label>当前重量</label>
          <div className="static">
            {fmtKg(intake.currentWeightKg)}（初始 {fmtKg(intake.initialWeightKg)}）
          </div>
          <label>
            新测量重量（kg）
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              required
            />
          </label>
          <label>
            复称原因
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="选填" />
          </label>
          {error && <div className="alert alert-red">{error}</div>}
          <div className="row">
            <button className="btn primary" disabled={busy}>
              保存复称
            </button>
            <button type="button" className="btn" onClick={onClose}>
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
