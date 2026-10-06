const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.message
      ? Array.isArray(body.message)
        ? body.message.join('；')
        : body.message
      : `请求失败（${res.status}）`;
    throw new Error(msg);
  }
  return body as T;
}

const post = (data: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(data) });

export interface Intake {
  id: string;
  serialNo: string;
  vehiclePlate: string;
  ownerName: string;
  ownerPhone?: string | null;
  physicalVerified: boolean;
  initialWeightKg: number;
  currentWeightKg: number;
  status: string;
  createdAt: string;
  voucher?: Voucher | null;
}

export interface Voucher {
  id: string;
  voucherNo: string;
  intakeId: string;
  newBatteryModel: string;
  newBatterySerial: string;
  issuedAt: string;
  intake?: Intake;
}

export interface Weighing {
  id: string;
  originalWeightKg: number;
  newWeightKg: number;
  reason?: string | null;
  createdAt: string;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  intakeId: string;
  sentWeightKg: number;
  intake: Intake;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  intakeId: string;
  receivedWeightKg: number | null;
  matchStatus: string;
  intake?: Intake;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  shipmentId: string;
  signerName: string;
  signatureData: string;
  receivedAt: string;
  items: ReceiptItem[];
}

export interface Shipment {
  id: string;
  shipmentNo: string;
  recyclerName: string;
  status: string;
  shippedAt: string;
  items: ShipmentItem[];
  receipts: Receipt[];
}

export interface TimelineEvent {
  stage: string;
  title: string;
  at: string;
  detail: string;
  matchStatus?: string;
  sentWeightKg?: number | null;
  receivedWeightKg?: number | null;
  diffKg?: number | null;
}

export interface TrackingResult {
  intake: Intake & { weighings: Weighing[] };
  voucher: Voucher | null;
  shipmentItem: (ShipmentItem & { shipment: Shipment }) | null;
  receiptItem: (ReceiptItem & { receipt: Receipt }) | null;
  timeline: TimelineEvent[];
}

export const api = {
  listIntakes: (status?: string) =>
    request<Intake[]>(`/intakes${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createIntake: (data: {
    serialNo: string;
    vehiclePlate: string;
    ownerName: string;
    ownerPhone?: string;
    weightKg: number;
    physicalVerified: boolean;
  }) => request<Intake>('/intakes', post(data)),
  reweigh: (id: string, data: { newWeightKg: number; reason?: string }) =>
    request<{ weighing: Weighing; intake: Intake }>(`/intakes/${id}/reweigh`, post(data)),
  listVouchers: () => request<Voucher[]>('/vouchers'),
  createVoucher: (data: { serialNo: string; newBatteryModel: string; newBatterySerial: string }) =>
    request<{ voucher: Voucher; alreadyIssued: boolean }>('/vouchers', post(data)),
  listShipments: () => request<Shipment[]>('/shipments'),
  createShipment: (data: { recyclerName: string; serialNos: string[] }) =>
    request<Shipment>('/shipments', post(data)),
  createReceipt: (data: {
    shipmentId: string;
    receiptNo: string;
    signerName: string;
    items: { serialNo: string; receivedWeightKg: number }[];
  }) => request<{ receipt: Receipt; duplicate: boolean }>('/receipts', post(data)),
  track: (serialNo: string) => request<TrackingResult>(`/tracking/${encodeURIComponent(serialNo)}`),
};
