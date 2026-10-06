import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { OldBattery, RecyclingReceipt } from '../types';
import { Banner, Field, StatusTag } from '../components/ui';

export default function ReceiptPanel({
  batteries,
  receipts,
  onChanged,
}: {
  batteries: OldBattery[];
  receipts: RecyclingReceipt[];
  onChanged: () => void;
}) {
  const [serial, setSerial] = useState('');
  const [form, setForm] = useState({
    customerName: '',
    vehiclePlate: '',
    newBatteryBrand: '',
    newBatteryModel: '',
    newBatterySerial: '',
    operator: '',
  });
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<OldBattery | null>(null);

  const issuedSerials = new Set(receipts.map((r) => r.oldBatterySerial));
  const selected = batteries.find((b) => b.serialNumber === serial) ?? null;

  useEffect(() => {
    if (!serial) {
      setPreview(null);
      return;
    }
    api
      .listBatteries()
      .then((all) => setPreview(all.find((b) => b.serialNumber === serial) ?? null))
      .catch(() => setPreview(null));
  }, [serial]);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.issueReceipt({ oldBatterySerial: serial, ...form });
      setSerial('');
      setForm({
        customerName: '',
        vehiclePlate: '',
        newBatteryBrand: '',
        newBatteryModel: '',
        newBatterySerial: '',
        operator: '',
      });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <form className="panel-card" onSubmit={submit}>
        <h2>② 开具旧件回收凭证</h2>
        <p className="muted">
          凭证分别列出<strong>新装电瓶</strong>与<strong>回收旧件</strong>。无实物入库记录不能开；一件旧件只能开一张。
        </p>
        <Field label="选择已核实入库的旧件编号 *">
          <select
            className="input"
            required
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
          >
            <option value="">— 请选择 —</option>
            {batteries.map((b) => (
              <option key={b.id} value={b.serialNumber}>
                {b.serialNumber}（{b.vehiclePlate}，{b.weightKg}kg）
                {issuedSerials.has(b.serialNumber) ? ' · 已开凭证' : ''}
              </option>
            ))}
          </select>
        </Field>

        {(preview ?? selected) && (
          <div className="receipt-preview">
            <div className="receipt-col">
              <h4>回收旧件（实物快照）</h4>
              <div>编号：{(preview ?? selected)!.serialNumber}</div>
              <div>车牌：{(preview ?? selected)!.vehiclePlate}</div>
              <div>重量：{(preview ?? selected)!.weightKg} kg</div>
              <div>
                状态：<StatusTag status={(preview ?? selected)!.status} />
              </div>
            </div>
            <div className="receipt-col">
              <h4>新装电瓶（本次填写）</h4>
              <div className="grid-2">
                <Field label="品牌 *">
                  <input className="input" required value={form.newBatteryBrand} onChange={set('newBatteryBrand')} placeholder="如 风帆" />
                </Field>
                <Field label="型号 *">
                  <input className="input" required value={form.newBatteryModel} onChange={set('newBatteryModel')} placeholder="如 12V-60Ah" />
                </Field>
                <Field label="序列号 *">
                  <input className="input" required value={form.newBatterySerial} onChange={set('newBatterySerial')} />
                </Field>
                <Field label="安装经手人 *">
                  <input className="input" required value={form.operator} onChange={set('operator')} />
                </Field>
              </div>
              <div className="grid-2">
                <Field label="车主姓名 *">
                  <input className="input" required value={form.customerName} onChange={set('customerName')} />
                </Field>
                <Field label="车牌号 *">
                  <input className="input" required value={form.vehiclePlate} onChange={set('vehiclePlate')} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {error && <Banner kind="err">⛔ {error}</Banner>}
        <button className="btn-primary" type="submit">
          开具回收凭证
        </button>
      </form>

      <div className="panel-card">
        <h3>已开凭证（{receipts.length}）</h3>
        <table className="table">
          <thead>
            <tr>
              <th>凭证号</th>
              <th>车主 / 车牌</th>
              <th>新装电瓶</th>
              <th>回收旧件</th>
              <th>开具时间</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.receiptNo}</td>
                <td>{r.customerName}<br /><span className="muted">{r.vehiclePlate}</span></td>
                <td>{r.newBatteryBrand} {r.newBatteryModel}<br /><span className="mono muted">{r.newBatterySerial}</span></td>
                <td><span className="mono">{r.oldBatterySerial}</span><br /><span className="muted">{r.oldWeightKg} kg</span></td>
                <td className="muted">{new Date(r.issuedAt).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
            {receipts.length === 0 && (
              <tr><td colSpan={5} className="muted center">暂无凭证</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
