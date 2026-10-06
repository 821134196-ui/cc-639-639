export const INTAKE_STATUS: Record<string, { label: string; color: string }> = {
  STORED: { label: '暂存中', color: 'blue' },
  SHIPPED: { label: '已发回收商', color: 'purple' },
  RECEIVED: { label: '回收商已实收', color: 'green' },
  DISPUTED: { label: '待核实', color: 'amber' },
};

export const SHIPMENT_STATUS: Record<string, { label: string; color: string }> = {
  IN_TRANSIT: { label: '在途', color: 'purple' },
  CONFIRMED: { label: '回收商已确认', color: 'green' },
  PENDING_VERIFICATION: { label: '待核实', color: 'amber' },
};

export const MATCH_STATUS: Record<string, { label: string; color: string }> = {
  MATCHED: { label: '相符', color: 'green' },
  MISMATCH: { label: '数量不符', color: 'amber' },
  MISSING: { label: '回执未含此件', color: 'red' },
};

export function Badge({ map, value }: { map: Record<string, { label: string; color: string }>; value: string }) {
  const s = map[value] ?? { label: value, color: 'gray' };
  return <span className={`badge badge-${s.color}`}>{s.label}</span>;
}

export function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

export function fmtKg(v?: number | null) {
  return v == null ? '—' : `${v.toFixed(1)} kg`;
}
