import { FormEvent, useState } from 'react';
import { api, Intake } from '../api';
import { fmtKg, fmtTime } from '../ui';

const empty = { serialNo: '', vehiclePlate: '', ownerName: '', ownerPhone: '', weightKg: '', physicalVerified: false };

export default function IntakePage() {
  const [form, setForm] = useState(empty);
  const [created, setCreated] = useState<Intake | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof empty>(key: K, value: (typeof empty)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setCreated(null);
    try {
      const intake = await api.createIntake({
        serialNo: form.serialNo.trim(),
        vehiclePlate: form.vehiclePlate.trim(),
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim() || undefined,
        weightKg: Number(form.weightKg),
        physicalVerified: form.physicalVerified,
      });
      setCreated(intake);
      setForm(empty);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>旧件入库登记</h1>
      <p className="hint">
        门店核实旧电瓶实物后，登记编号、重量与车辆。未核实实物不能入库，也不能开具回收凭证；同一编号重复入库会被拦截。
      </p>
      <form className="card form" onSubmit={submit}>
        <label>
          旧件编号
          <input
            value={form.serialNo}
            onChange={(e) => set('serialNo', e.target.value)}
            placeholder="如 BAT-2026-0005"
            required
          />
        </label>
        <label>
          车牌号
          <input
            value={form.vehiclePlate}
            onChange={(e) => set('vehiclePlate', e.target.value)}
            placeholder="如 沪A·D12345"
            required
          />
        </label>
        <label>
          车主姓名
          <input value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} required />
        </label>
        <label>
          联系电话
          <input value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
        </label>
        <label>
          重量（kg）
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={form.weightKg}
            onChange={(e) => set('weightKg', e.target.value)}
            required
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.physicalVerified}
            onChange={(e) => set('physicalVerified', e.target.checked)}
          />
          已当面核实旧件实物（未核实不能入库）
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? '提交中…' : '登记入库'}
        </button>
      </form>
      {error && <div className="alert alert-red">{error}</div>}
      {created && (
        <div className="alert alert-green">
          已入库：{created.serialNo}（{fmtKg(created.currentWeightKg)}，{created.vehiclePlate}，
          {fmtTime(created.createdAt)}），状态：暂存中。可前往「回收凭证」为车主开具凭证。
        </div>
      )}
    </div>
  );
}
