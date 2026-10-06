import { FormEvent, useEffect, useState } from 'react';
import { api, Voucher } from '../api';
import { Badge, INTAKE_STATUS, fmtKg, fmtTime } from '../ui';

export default function VouchersPage() {
  const [serialNo, setSerialNo] = useState('');
  const [model, setModel] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [highlight, setHighlight] = useState<Voucher | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setVouchers(await api.listVouchers());
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setHighlight(null);
    try {
      const res = await api.createVoucher({
        serialNo: serialNo.trim(),
        newBatteryModel: model.trim(),
        newBatterySerial: newSerial.trim(),
      });
      setHighlight(res.voucher);
      if (res.alreadyIssued) setNotice('该旧件已开具过回收凭证，下方为原凭证，不重复开具。');
      setSerialNo('');
      setModel('');
      setNewSerial('');
      reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>回收凭证</h1>
      <p className="hint">凭证分别列出新装电瓶与回收旧件。没有收到旧件实物（未核实入库）不能开具。</p>
      <form className="card form" onSubmit={submit}>
        <label>
          回收旧件编号
          <input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} placeholder="旧件入库编号" required />
        </label>
        <label>
          新装电瓶型号
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="如 骆驼 6-QW-60" required />
        </label>
        <label>
          新装电瓶编号
          <input value={newSerial} onChange={(e) => setNewSerial(e.target.value)} required />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? '开具中…' : '开具回收凭证'}
        </button>
      </form>
      {error && <div className="alert alert-red">{error}</div>}
      {notice && <div className="alert alert-amber">{notice}</div>}
      {highlight && <VoucherCard voucher={highlight} />}
      <h2>已开具凭证</h2>
      {vouchers.map((v) => (
        <VoucherCard key={v.id} voucher={v} />
      ))}
      {vouchers.length === 0 && <p className="muted">暂无凭证</p>}
    </div>
  );
}

function VoucherCard({ voucher }: { voucher: Voucher }) {
  const intake = voucher.intake!;
  return (
    <div className="card voucher">
      <div className="voucher-head">
        <div>
          <div className="voucher-title">旧电瓶回收凭证</div>
          <div className="mono voucher-no">{voucher.voucherNo}</div>
        </div>
        <div className="muted">{fmtTime(voucher.issuedAt)}</div>
      </div>
      <div className="voucher-grid">
        <div>
          <span className="k">车主</span>
          {intake.ownerName}
          {intake.ownerPhone ? `（${intake.ownerPhone}）` : ''}
        </div>
        <div>
          <span className="k">车辆</span>
          {intake.vehiclePlate}
        </div>
        <div>
          <span className="k">新装电瓶</span>
          {voucher.newBatteryModel} ／ 编号 {voucher.newBatterySerial}
        </div>
        <div>
          <span className="k">回收旧件</span>
          <span className="mono">{intake.serialNo}</span> ／ {fmtKg(intake.currentWeightKg)}
          <Badge map={INTAKE_STATUS} value={intake.status} />
        </div>
      </div>
    </div>
  );
}
