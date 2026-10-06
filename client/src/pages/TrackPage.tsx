import { FormEvent, useState } from 'react';
import { api, TrackingResult } from '../api';
import { Badge, INTAKE_STATUS, fmtKg, fmtTime } from '../ui';

export default function TrackPage() {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!serial.trim()) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await api.track(serial.trim()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <h1>去向追踪</h1>
      <p className="hint">
        车主与门店可沿旧件编号查看去向：入库 → 凭证 → 暂存 → 发给回收商 → 对方实收。试试 BAT-2026-0001（已实收）或
        BAT-2026-0002（待核实）。
      </p>
      <form className="card form search" onSubmit={search}>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="输入旧件编号，如 BAT-2026-0001"
        />
        <button className="btn primary" disabled={busy}>
          {busy ? '查询中…' : '查询'}
        </button>
      </form>
      {error && <div className="alert alert-red">{error}</div>}
      {result && <TrackResult result={result} />}
    </div>
  );
}

function TrackResult({ result }: { result: TrackingResult }) {
  const { intake, voucher, timeline } = result;
  return (
    <div>
      <div className="card">
        <div className="shipment-head">
          <div>
            <span className="mono strong">{intake.serialNo}</span>
            <span className="muted">
              　{intake.vehiclePlate} ／ 车主 {intake.ownerName}
            </span>
          </div>
          <Badge map={INTAKE_STATUS} value={intake.status} />
        </div>
        <div className="voucher-grid">
          <div>
            <span className="k">初始重量</span>
            {fmtKg(intake.initialWeightKg)}
          </div>
          <div>
            <span className="k">当前重量</span>
            {fmtKg(intake.currentWeightKg)}
          </div>
          <div>
            <span className="k">入库时间</span>
            {fmtTime(intake.createdAt)}
          </div>
          <div>
            <span className="k">回收凭证</span>
            {voucher ? <span className="mono">{voucher.voucherNo}</span> : '未开具'}
          </div>
        </div>
        {voucher && (
          <div className="voucher-sub">
            新装电瓶：{voucher.newBatteryModel}（编号 {voucher.newBatterySerial}）　回收旧件：{intake.serialNo}（
            {fmtKg(intake.currentWeightKg)}）
          </div>
        )}
      </div>
      <ul className="timeline">
        {timeline.map((ev, idx) => (
          <li key={idx} className={`tl-item ${ev.matchStatus && ev.matchStatus !== 'MATCHED' ? 'tl-warn' : ''}`}>
            <div className="tl-dot" />
            <div className="tl-body">
              <div className="tl-head">
                <span className="tl-title">{ev.title}</span>
                <span className="tl-time">{fmtTime(ev.at)}</span>
              </div>
              <div className="tl-detail">{ev.detail}</div>
              {ev.matchStatus === 'MISMATCH' && (
                <div className="alert alert-amber">
                  发出 {fmtKg(ev.sentWeightKg)}，实收 {fmtKg(ev.receivedWeightKg)}，差额{' '}
                  {ev.diffKg! > 0 ? '+' : ''}
                  {ev.diffKg} kg。差额保留待核实，发出记录未改动。
                </div>
              )}
              {ev.matchStatus === 'MISSING' && (
                <div className="alert alert-amber">
                  回收商回执中未包含该旧件（发出 {fmtKg(ev.sentWeightKg)}），待核实。
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
