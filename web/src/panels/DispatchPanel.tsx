import { FormEvent, useRef, useState } from 'react';
import { api } from '../api';
import { DispatchBatch, OldBattery } from '../types';
import { Banner, Field, StatusTag } from '../components/ui';
import SignaturePad, { SignaturePadHandle } from '../components/SignaturePad';

export default function DispatchPanel({
  batteries,
  batches,
  onChanged,
}: {
  batteries: OldBattery[];
  batches: DispatchBatch[];
  onChanged: () => void;
}) {
  const staged = batteries.filter((b) => b.status === 'STAGED');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [recyclerName, setRecyclerName] = useState('');
  const [operator, setOperator] = useState('');
  const [shipError, setShipError] = useState('');
  const [shipOk, setShipOk] = useState('');

  const [ackBatchId, setAckBatchId] = useState<number | null>(null);
  const [receivedCount, setReceivedCount] = useState('');
  const [receivedSerialsText, setReceivedSerialsText] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const [ackNote, setAckNote] = useState('');
  const [ackError, setAckError] = useState('');
  const [ackOk, setAckOk] = useState('');
  const padRef = useRef<SignaturePadHandle>(null);

  function toggle(serial: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(serial)) next.delete(serial);
      else next.add(serial);
      return next;
    });
  }

  async function ship(e: FormEvent) {
    e.preventDefault();
    setShipError('');
    setShipOk('');
    if (picked.size === 0) {
      setShipError('请勾选至少一件暂存旧件');
      return;
    }
    try {
      await api.createDispatch({
        recyclerName,
        operator,
        serialNumbers: [...picked],
      });
      setShipOk(`已发货 ${picked.size} 件给 ${recyclerName}`);
      setPicked(new Set());
      setRecyclerName('');
      setOperator('');
      onChanged();
    } catch (err) {
      setShipError((err as Error).message);
    }
  }

  async function submitAck(e: FormEvent) {
    e.preventDefault();
    if (ackBatchId === null) return;
    setAckError('');
    setAckOk('');
    const signature = padRef.current?.getData();
    if (!signature) {
      setAckError('请先在签名区手写电子签名');
      return;
    }
    const receivedSerials = receivedSerialsText
      .split(/[\s,，、]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const batch = await api.acknowledge(ackBatchId, {
        receivedCount: Number(receivedCount),
        receivedSerials,
        signedBy,
        signatureData: signature,
        note: ackNote,
      });
      const b = batch as DispatchBatch;
      setAckOk(
        b.status === 'PENDING_RECONCILIATION'
          ? `回执已记录：数量不符，批次标记为待核实，差额 ${b.differenceCount} 件已保留（未改成一致）`
          : '回执已记录：发出数与实收数一致',
      );
      setAckBatchId(null);
      setReceivedCount('');
      setReceivedSerialsText('');
      setSignedBy('');
      setAckNote('');
      padRef.current?.clear();
      onChanged();
    } catch (err) {
      setAckError((err as Error).message);
    }
  }

  const ackBatch = batches.find((b) => b.id === ackBatchId);

  return (
    <div className="stack">
      <form className="panel-card" onSubmit={ship}>
        <h2>④ 暂存旧件发给回收商</h2>
        <div className="grid-2">
          <Field label="回收商名称 *">
            <input className="input" required value={recyclerName} onChange={(e) => setRecyclerName(e.target.value)} placeholder="如 绿源再生资源公司" />
          </Field>
          <Field label="发货经手人 *">
            <input className="input" required value={operator} onChange={(e) => setOperator(e.target.value)} />
          </Field>
        </div>
        <div className="pick-list">
          {staged.map((b) => (
            <label key={b.id} className={`pick-item ${picked.has(b.serialNumber) ? 'picked' : ''}`}>
              <input type="checkbox" checked={picked.has(b.serialNumber)} onChange={() => toggle(b.serialNumber)} />
              <span className="mono">{b.serialNumber}</span>
              <span className="muted">{b.vehiclePlate} · {b.weightKg}kg</span>
            </label>
          ))}
          {staged.length === 0 && <p className="muted">暂存区没有可发旧件</p>}
        </div>
        {shipError && <Banner kind="err">⛔ {shipError}</Banner>}
        {shipOk && <Banner kind="ok">✅ {shipOk}</Banner>}
        <button className="btn-primary" type="submit" disabled={staged.length === 0}>
          发货（已选 {picked.size} 件）
        </button>
      </form>

      <div className="panel-card">
        <h2>⑤ 回收商签收回执（本地电子签收）</h2>
        <p className="muted">
          每个批次<strong>只能签收一次</strong>；实收数与发出数不符时批次进入「待核实」并保留差额，系统不会把数字改成一致。
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>批次号</th>
              <th>回收商</th>
              <th>发出/实收/差额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.batchNo}</td>
                <td>{b.recyclerName}</td>
                <td>
                  发出 <strong>{b.shippedCount}</strong> / 实收{' '}
                  <strong>{b.receivedCount ?? '—'}</strong> / 差额{' '}
                  <strong className={b.differenceCount ? 'warn-text' : ''}>
                    {b.differenceCount ?? '—'}
                  </strong>
                </td>
                <td><StatusTag status={b.status} /></td>
                <td>
                  {b.acknowledgment ? (
                    <span className="muted small">
                      已由 {b.acknowledgment.signedBy} 签收
                      {b.status === 'PENDING_RECONCILIATION' && ' · 待核实'}
                    </span>
                  ) : (
                    <button
                      className="btn-link"
                      onClick={() => {
                        setAckBatchId(b.id);
                        setReceivedCount(String(b.shippedCount));
                        setAckError('');
                        setAckOk('');
                      }}
                    >
                      电子签收
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={5} className="muted center">暂无发货批次</td></tr>
            )}
          </tbody>
        </table>

        {ackBatch && (
          <form className="ack-form" onSubmit={submitAck}>
            <h4>批次 {ackBatch.batchNo} 签收回执</h4>
            <p className="muted">本批次发出 {ackBatch.shippedCount} 件：{ackBatch.items.map((i) => i.battery.serialNumber).join('、')}</p>
            <div className="grid-3">
              <Field label="回收商实收数量 *">
                <input className="input" type="number" min="0" required value={receivedCount} onChange={(e) => setReceivedCount(e.target.value)} />
              </Field>
              <Field label="签收人 *">
                <input className="input" required value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="回收商经手人" />
              </Field>
              <Field label="备注">
                <input className="input" value={ackNote} onChange={(e) => setAckNote(e.target.value)} placeholder="数量不符时说明原因" />
              </Field>
            </div>
            <Field label="按编号确认收到（可留空；用空格/逗号分隔）" hint="留空表示只报总数；填写后逐件标记，且编号数不能多于实收数">
              <input className="input" value={receivedSerialsText} onChange={(e) => setReceivedSerialsText(e.target.value)} />
            </Field>
            <Field label="电子签名 *（本地模拟）">
              <SignaturePad ref={padRef} />
            </Field>
            {ackError && <Banner kind="err">⛔ {ackError}</Banner>}
            {ackOk && <Banner kind="ok">✅ {ackOk}</Banner>}
            <div className="row-gap">
              <button className="btn-primary" type="submit">提交签收回执</button>
              <button type="button" className="btn-ghost" onClick={() => setAckBatchId(null)}>取消</button>
            </div>
          </form>
        )}
        {!ackBatch && ackOk && <Banner kind="ok">✅ {ackOk}</Banner>}
      </div>
    </div>
  );
}
