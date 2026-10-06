const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data?.message
        ? Array.isArray(data.message)
          ? data.message.join('；')
          : data.message
        : `请求失败 (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  intake: (body: unknown) =>
    request('/batteries/intake', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listBatteries: (status?: string) =>
    request<import('./types').OldBattery[]>(
      `/batteries${status ? `?status=${status}` : ''}`,
    ),
  reweigh: (serial: string, body: unknown) =>
    request(`/batteries/${encodeURIComponent(serial)}/reweigh`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  issueReceipt: (body: unknown) =>
    request('/receipts', { method: 'POST', body: JSON.stringify(body) }),
  listReceipts: () =>
    request<import('./types').RecyclingReceipt[]>('/receipts'),
  listDispatches: () =>
    request<import('./types').DispatchBatch[]>('/dispatches'),
  createDispatch: (body: unknown) =>
    request('/dispatches', { method: 'POST', body: JSON.stringify(body) }),
  acknowledge: (id: number, body: unknown) =>
    request(`/dispatches/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  trace: (serial: string) =>
    request<import('./types').TraceResult>(
      `/trace/${encodeURIComponent(serial)}`,
    ),
};
