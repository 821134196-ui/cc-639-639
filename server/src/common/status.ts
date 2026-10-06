// SQLite 不支持枚举，状态用字符串常量统一管理
export const IntakeStatus = {
  STORED: 'STORED', // 暂存中
  SHIPPED: 'SHIPPED', // 已发回收商
  RECEIVED: 'RECEIVED', // 回收商已实收
  DISPUTED: 'DISPUTED', // 待核实
} as const;

export const ShipmentStatus = {
  IN_TRANSIT: 'IN_TRANSIT', // 在途
  CONFIRMED: 'CONFIRMED', // 回收商已确认
  PENDING_VERIFICATION: 'PENDING_VERIFICATION', // 待核实
} as const;

export const MatchStatus = {
  MATCHED: 'MATCHED', // 相符
  MISMATCH: 'MISMATCH', // 数量不符
  MISSING: 'MISSING', // 回执未含此件
} as const;
