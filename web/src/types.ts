export type BatteryStatus = 'STAGED' | 'DISPATCHED' | 'ACKNOWLEDGED';
export type BatchStatus =
  | 'SHIPPED'
  | 'ACKNOWLEDGED'
  | 'PENDING_RECONCILIATION';

export interface WeightRecord {
  id: number;
  previousWeightKg: number;
  newWeightKg: number;
  operator: string;
  reason: string | null;
  createdAt: string;
}

export interface OldBattery {
  id: number;
  serialNumber: string;
  vehiclePlate: string;
  vehicleModel: string | null;
  customerName: string | null;
  weightKg: number;
  physicalVerifiedAt: string;
  intakeOperator: string;
  status: BatteryStatus;
  createdAt: string;
  weightRecords?: WeightRecord[];
}

export interface RecyclingReceipt {
  id: number;
  receiptNo: string;
  customerName: string;
  vehiclePlate: string;
  newBatteryBrand: string;
  newBatteryModel: string;
  newBatterySerial: string;
  installedAt: string;
  oldBatterySerial: string;
  oldWeightKg: number;
  operator: string;
  issuedAt: string;
}

export interface DispatchItem {
  id: number;
  received: boolean;
  battery: OldBattery;
}

export interface DispatchAcknowledgment {
  id: number;
  receivedCount: number;
  receivedSerials: string;
  signedBy: string;
  signatureData: string;
  note: string | null;
  signedAt: string;
}

export interface DispatchBatch {
  id: number;
  batchNo: string;
  recyclerName: string;
  operator: string;
  status: BatchStatus;
  shippedCount: number;
  receivedCount: number | null;
  differenceCount: number | null;
  note: string | null;
  dispatchedAt: string;
  acknowledgedAt: string | null;
  items: DispatchItem[];
  acknowledgment: DispatchAcknowledgment | null;
}

export interface TraceEvent {
  stage: string;
  at: string;
  title: string;
  detail: string;
}

export interface TraceResult {
  serialNumber: string;
  status: BatteryStatus;
  currentWeightKg: number;
  vehiclePlate: string;
  receiptIssued: boolean;
  receiptNo: string | null;
  events: TraceEvent[];
  batch: {
    batchNo: string;
    recyclerName: string;
    status: BatchStatus;
    shippedCount: number;
    receivedCount: number | null;
    differenceCount: number | null;
  } | null;
}
