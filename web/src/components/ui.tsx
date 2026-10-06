import { ReactNode } from 'react';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Banner({
  kind,
  children,
}: {
  kind: 'ok' | 'err' | 'warn';
  children: ReactNode;
}) {
  return <div className={`banner banner-${kind}`}>{children}</div>;
}

export const inputCls = 'input';

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    STAGED: { text: '暂存中', cls: 'tag-staged' },
    DISPATCHED: { text: '已发出', cls: 'tag-dispatched' },
    ACKNOWLEDGED: { text: '回收商实收', cls: 'tag-acked' },
    SHIPPED: { text: '已发出待签收', cls: 'tag-dispatched' },
    PENDING_RECONCILIATION: { text: '数量不符 · 待核实', cls: 'tag-pending' },
  };
  const item = map[status] ?? { text: status, cls: 'tag-staged' };
  return <span className={`tag ${item.cls}`}>{item.text}</span>;
}
