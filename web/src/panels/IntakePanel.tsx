import { FormEvent, useState } from 'react';
import { api } from '../api';
import { Banner, Field } from '../components/ui';

export default function IntakePanel({ onChanged }: { onChanged: () => void }) {
  const [form, setForm] = useState({
    serialNumber: '',
    vehiclePlate: '',
    vehicleModel: '',
    customerName: '',
    weightKg: '',
    intakeOperator: '',
    intakeNote: '',
  });
  const [physicalVerified, setPhysicalVerified] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const created = await api.intake({
        ...form,
        weightKg: Number(form.weightKg),
        physicalVerified,
      });
      setOk(`入库成功：旧件 ${(created as { serialNumber: string }).serialNumber} 已暂存`);
      setForm({
        serialNumber: '',
        vehiclePlate: '',
        vehicleModel: '',
        customerName: '',
        weightKg: '',
        intakeOperator: '',
        intakeNote: '',
      });
      setPhysicalVerified(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="panel-card" onSubmit={submit}>
      <h2>① 旧件入库登记</h2>
      <p className="muted">
        门店核实旧件实物后登记编号、重量和车辆。未核实实物不能入库；同一编号再次入库将被拦截。
      </p>
      <div className="grid-2">
        <Field label="旧件编号 *">
          <input className="input" required value={form.serialNumber} onChange={set('serialNumber')} placeholder="如 OLD-A12-0001" />
        </Field>
        <Field label="车牌号 *">
          <input className="input" required value={form.vehiclePlate} onChange={set('vehiclePlate')} placeholder="如 沪A·12345" />
        </Field>
        <Field label="车型">
          <input className="input" value={form.vehicleModel} onChange={set('vehicleModel')} />
        </Field>
        <Field label="车主姓名">
          <input className="input" value={form.customerName} onChange={set('customerName')} />
        </Field>
        <Field label="重量 (kg) *">
          <input className="input" type="number" step="0.001" min="0.001" required value={form.weightKg} onChange={set('weightKg')} />
        </Field>
        <Field label="登记经手人 *">
          <input className="input" required value={form.intakeOperator} onChange={set('intakeOperator')} />
        </Field>
      </div>
      <Field label="备注">
        <input className="input" value={form.intakeNote} onChange={set('intakeNote')} />
      </Field>

      <label className="verify-check">
        <input
          type="checkbox"
          checked={physicalVerified}
          onChange={(e) => setPhysicalVerified(e.target.checked)}
        />
        <span>
          我已<strong>当面核实旧件实物</strong>（编号、外观、数量与登记一致）
        </span>
      </label>

      {error && <Banner kind="err">⛔ {error}</Banner>}
      {ok && <Banner kind="ok">✅ {ok}</Banner>}

      <button className="btn-primary" type="submit" disabled={!physicalVerified}>
        核实实物并登记入库
      </button>
      {!physicalVerified && (
        <p className="field-hint">勾选实物核实后才能提交（无实物不能登记、不能开凭证）</p>
      )}
    </form>
  );
}
