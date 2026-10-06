/** 旧件状态 */
export const BatteryStatus = {
  STAGED: 'STAGED', // 在库暂存
  DISPATCHED: 'DISPATCHED', // 已发给回收商，尚未签收
  ACKNOWLEDGED: 'ACKNOWLEDGED', // 回收商已实收
} as const;

/** 发出批次状态 */
export const BatchStatus = {
  SHIPPED: 'SHIPPED', // 已发出
  ACKNOWLEDGED: 'ACKNOWLEDGED', // 实收一致
  PENDING_RECONCILIATION: 'PENDING_RECONCILIATION', // 数量不符，待核实
} as const;

export type BatteryStatusValue =
  (typeof BatteryStatus)[keyof typeof BatteryStatus];
export type BatchStatusValue =
  (typeof BatchStatus)[keyof typeof BatchStatus];
