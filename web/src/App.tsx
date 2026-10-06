import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { DispatchBatch, OldBattery, RecyclingReceipt } from './types';
import IntakePanel from './panels/IntakePanel';
import ReceiptPanel from './panels/ReceiptPanel';
import InventoryPanel from './panels/InventoryPanel';
import DispatchPanel from './panels/DispatchPanel';
import TracePanel from './panels/TracePanel';

const TABS = [
  { key: 'intake', label: '入库登记' },
  { key: 'receipt', label: '回收凭证' },
  { key: 'inventory', label: '库存与复称' },
  { key: 'dispatch', label: '发货与签收' },
  { key: 'trace', label: '去向追踪' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function App() {
  const [tab, setTab] = useState<TabKey>('intake');
  const [batteries, setBatteries] = useState<OldBattery[]>([]);
  const [receipts, setReceipts] = useState<RecyclingReceipt[]>([]);
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [b, r, d] = await Promise.all([
        api.listBatteries(),
        api.listReceipts(),
        api.listDispatches(),
      ]);
      setBatteries(b);
      setReceipts(r);
      setBatches(d);
      setLoadError('');
    } catch (e) {
      setLoadError(`无法连接后端 API：${(e as Error).message}。请确认 server 已启动（npm run dev）。`);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pendingBatches = batches.filter(
    (b) => b.status === 'PENDING_RECONCILIATION',
  ).length;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔋 旧电瓶回收凭证与去向追踪</h1>
        <p className="muted">
          实物核实才入库 · 无实物不开凭证 · 编号唯一 · 复称留痕 · 签收回执幂等 · 数量不符保留差额待核实
        </p>
        {pendingBatches > 0 && (
          <div className="pending-strip">⚠️ 有 {pendingBatches} 个发货批次数量不符，待核实</div>
        )}
        {loadError && <div className="banner banner-err">{loadError}</div>}
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'intake' && <IntakePanel onChanged={refresh} />}
        {tab === 'receipt' && (
          <ReceiptPanel batteries={batteries} receipts={receipts} onChanged={refresh} />
        )}
        {tab === 'inventory' && (
          <InventoryPanel batteries={batteries} onChanged={refresh} />
        )}
        {tab === 'dispatch' && (
          <DispatchPanel batteries={batteries} batches={batches} onChanged={refresh} />
        )}
        {tab === 'trace' && <TracePanel />}
      </main>

      <footer className="app-footer muted">
        本地模拟环境 · TypeScript + NestJS + React + Prisma + SQLite · 电子签收仅本地模拟
      </footer>
    </div>
  );
}
