import { FormEvent, useState } from 'react';
import { api } from '../api';
import { TraceResult } from '../types';
import { Banner, StatusTag } from '../components/ui';

const STAGE_ICON: Record<string, string> = {
  INTAKE: '📥',
  REWEIGH: '⚖️',
  RECEIPT_ISSUED: '🧾',
  DISPATCHED: '🚚',
  RECEIVED_BY_RECYCLER: '✅',
  ACKNOWLEDGED: '📝',
};

export default function TracePanel() {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [error, setError] = useState('');

  async function query(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      setResult(await api.trace(serial.trim()));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="panel-card">
      <h2>⑥ 旧件去向追踪</h2>
      <p className="muted">
        车主或门店输入旧件编号，即可沿编号查看：入库核实 → 凭证 → 发给回收商 → 对方实收。
      </p>
      <form className="trace-bar" onSubmit={query}>
        <input
          className="input"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="输入旧件编号，如 OLD-A12-0001"
          required
        />
        <button className="btn-primary" type="submit">查询去向</button>
      </form>

      {error && <Banner kind="err">⛔ {error}</Banner>}

      {result && (
        <div className="trace-result">
          <div className="trace-head">
            <div>
              <span className="mono big">{result.serialNumber}</span>
              <span className="muted"> · 车牌 {result.vehiclePlate} · 当前重量 {result.currentWeightKg} kg</span>
              <div className="small">
                回收凭证：
                {result.receiptIssued ? (
                  <span className="mono">{result.receiptNo}</span>
                ) : (
                  <span className="warn-text">尚未开具</span>
                )}
              </div>
            </div>
            <StatusTag status={result.status} />
          </div>

          {result.batch?.status === 'PENDING_RECONCILIATION' && (
            <Banner kind="warn">
              ⚠️ 批次 {result.batch.batchNo} 数量不符，待核实：发出 {result.batch.shippedCount} 件，
              实收 {result.batch.receivedCount} 件，差额 {result.batch.differenceCount} 件。
              原始数据已保留，未改成一致。
            </Banner>
          )}

          <ol className="timeline">
            {result.events.map((ev, i) => (
              <li key={i} className={`tl-item tl-${ev.stage.toLowerCase()}`}>
                <div className="tl-icon">{STAGE_ICON[ev.stage] ?? '•'}</div>
                <div className="tl-body">
                  <div className="tl-title">{ev.title}</div>
                  <div className="tl-detail">{ev.detail}</div>
                  <div className="tl-time">{new Date(ev.at).toLocaleString('zh-CN')}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
