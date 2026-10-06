import { FormEvent, useEffect, useState } from 'react';
import { api, Intake, Shipment } from '../api';
import { Badge, MATCH_STATUS, SHIPMENT_STATUS, fmtKg, fmtTime } from '../ui';

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stored, setStored] = useState<Intake[]>([]);
  const [recycler, setRecycler] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function reload() {
    const [s, st] = await Promise.all([api.listShipments(), api.listIntakes('STORED')]);
    setShipments(s);
    setStored(st);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);

  function toggle(serial: string) {
    setSelected((cur) => (cur.includes(serial) ? cur.filter((s) => s !== serial) : [...cur, serial]));
  }

  async function createShipment(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const s = await api.createShipment({ recyclerName: recycler.trim(), serialNos: selected });
      setMsg(`已创建发货批次 ${s.shipmentNo}（${selected.length} 件 → ${recycler.trim()}）`);
      setRecycler('');
      setSelected([]);
      await reload();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>发货与签收</h1>
      <section className="card">
        <h2>发往回收商</h2>
        {stored.length === 0 ? (
          <p className="muted">暂存库存为空，请先在「旧件入库」登记。</p>
        ) : (
          <form className="form" onSubmit={createShipment}>
            <label>
              回收商名称
              <input
                value={recycler}
                onChange={(e) => setRecycler(e.target.value)}
                placeholder="如 绿源再生资源回收"
                required
              />
            </label>
            <div className="pick-list">
              {stored.map((i) => (
                <label key={i.id} className="pick">
                  <input type="checkbox" checked={selected.includes(i.serialNo)} onChange={() => toggle(i.serialNo)} />
                  <span className="mono">{i.serialNo}</span>
                  <span>{i.vehiclePlate}</span>
                  <span>{fmtKg(i.currentWeightKg)}</span>
                </label>
              ))}
            </div>
            <button className="btn primary" disabled={selected.length === 0 || !recycler.trim()}>
              创建发货批次（已选 {selected.length} 件）
            </button>
          </form>
        )}
      </section>
      {msg && <div className="alert alert-green">{msg}</div>}
      {error && <div className="alert alert-red">{error}</div>}
      {shipments.map((s) => (
        <ShipmentCard key={s.id} shipment={s} onChanged={reload} />
      ))}
    </div>
  );
}

function ShipmentCard({ shipment, onChanged }: { shipment: Shipment; onChanged: () => Promise<void> | void }) {
  const receipt = shipment.receipts[0] ?? null;
  const receiptByIntake = new Map((receipt?.items ?? []).map((i) => [i.intakeId, i]));
  const [receiptNo, setReceiptNo] = useState('');
  const [signer, setSigner] = useState('');
  const [rows, setRows] = useState<Record<string, { checked: boolean; weight: string }>>(() =>
    Object.fromEntries(shipment.items.map((it) => [it.intakeId, { checked: true, weight: String(it.sentWeightKg) }])),
  );
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitReceipt(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const items = shipment.items
        .filter((it) => rows[it.intakeId]?.checked)
        .map((it) => ({ serialNo: it.intake.serialNo, receivedWeightKg: Number(rows[it.intakeId].weight) }));
      const res = await api.createReceipt({
        shipmentId: shipment.id,
        receiptNo: receiptNo.trim(),
        signerName: signer.trim(),
        items,
      });
      if (res.duplicate) setNotice(`回执 ${receiptNo.trim()} 已签收过，系统只记一次，未重复入账。`);
      await onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="shipment-head">
        <div>
          <span className="mono strong">{shipment.shipmentNo}</span>
          <span className="muted">
            {' '}
            → {shipment.recyclerName} ／ {fmtTime(shipment.shippedAt)}
          </span>
        </div>
        <Badge map={SHIPMENT_STATUS} value={shipment.status} />
      </div>

      {shipment.status === 'PENDING_VERIFICATION' && (
        <div className="alert alert-amber">回收商实收与门店发出不符：差额已保留、发出记录未改动，状态待核实。</div>
      )}

      <table>
        <thead>
          <tr>
            <th>旧件编号</th>
            <th>发出重量</th>
            {receipt && (
              <>
                <th>实收重量</th>
                <th>差额</th>
                <th>核对</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {shipment.items.map((it) => {
            const ri = receiptByIntake.get(it.intakeId);
            const diff = ri && ri.receivedWeightKg != null ? ri.receivedWeightKg - it.sentWeightKg : null;
            return (
              <tr key={it.id}>
                <td className="mono">{it.intake.serialNo}</td>
                <td>{fmtKg(it.sentWeightKg)}</td>
                {receipt && (
                  <>
                    <td>{ri ? fmtKg(ri.receivedWeightKg) : '—'}</td>
                    <td className={diff != null && diff !== 0 ? 'diff' : ''}>
                      {diff != null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg` : '—'}
                    </td>
                    <td>{ri ? <Badge map={MATCH_STATUS} value={ri.matchStatus} /> : '—'}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {receipt ? (
        <div className="receipt-info">
          <span>
            回执号 <span className="mono">{receipt.receiptNo}</span>
          </span>
          <span>签收人 {receipt.signerName}</span>
          <span>
            电子签名 <span className="mono">{receipt.signatureData}</span>
          </span>
          <span>{fmtTime(receipt.receivedAt)}</span>
        </div>
      ) : (
        <form className="form receipt-form" onSubmit={submitReceipt}>
          <h3>回收商签收（本地模拟电子签收）</h3>
          <div className="row">
            <label>
              回执号
              <input
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder="如 RCPT-2026-0902"
                required
              />
            </label>
            <label>
              签收人
              <input value={signer} onChange={(e) => setSigner(e.target.value)} required />
            </label>
          </div>
          <div className="pick-list">
            {shipment.items.map((it) => {
              const row = rows[it.intakeId];
              return (
                <div key={it.id} className="pick">
                  <label>
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => setRows((r) => ({ ...r, [it.intakeId]: { ...row, checked: e.target.checked } }))}
                    />
                    <span className="mono">{it.intake.serialNo}</span>（发出 {fmtKg(it.sentWeightKg)}）
                  </label>
                  {row.checked && (
                    <label className="inline">
                      实收 kg
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={row.weight}
                        onChange={(e) => setRows((r) => ({ ...r, [it.intakeId]: { ...row, weight: e.target.value } }))}
                        required
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="hint">
            未勾选的旧件将记为「回执未含此件」；实收与发出不符时批次转为待核实，差额保留。同一回执号重复提交只记一次。
          </p>
          {error && <div className="alert alert-red">{error}</div>}
          {notice && <div className="alert alert-amber">{notice}</div>}
          <button className="btn primary" disabled={busy}>
            {busy ? '签收中…' : '确认签收'}
          </button>
        </form>
      )}
    </section>
  );
}
