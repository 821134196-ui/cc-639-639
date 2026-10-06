import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

jest.setTimeout(60000);

describe('旧电瓶回收凭证与去向追踪 —— 业务规则验证', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = modRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  const intake = (over: Record<string, unknown> = {}) =>
    http.post('/api/batteries/intake').send({
      serialNumber: 'OLD-TEST-001',
      vehiclePlate: '沪A·10001',
      vehicleModel: '卡罗拉',
      customerName: '张三',
      weightKg: 15.5,
      intakeOperator: '店员小王',
      physicalVerified: true,
      ...over,
    });

  // ---------- 规则 1：没有核实实物不能入库、不能开凭证 ----------
  it('拒绝未核实实物的入库登记', async () => {
    const res = await intake({
      serialNumber: 'OLD-NO-PHYSICAL',
      physicalVerified: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('实物');

    // 数据库中不应存在该件
    const list = await http.get('/api/batteries').expect(200);
    expect(
      list.body.find((b: { serialNumber: string }) => b.serialNumber === 'OLD-NO-PHYSICAL'),
    ).toBeUndefined();
  });

  it('对没有实物入库记录的编号拒绝开具回收凭证', async () => {
    const res = await http.post('/api/receipts').send({
      oldBatterySerial: 'OLD-GHOST-999',
      customerName: '李四',
      vehiclePlate: '京B·00000',
      newBatteryBrand: '风帆',
      newBatteryModel: '12V-60Ah',
      newBatterySerial: 'NEW-001',
      operator: '店员小王',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('实物');
  });

  it('正常核实实物后入库成功', async () => {
    const res = await intake();
    expect(res.status).toBe(201);
    expect(res.body.serialNumber).toBe('OLD-TEST-001');
    expect(res.body.status).toBe('STAGED');
    expect(res.body.physicalVerifiedAt).toBeTruthy();
  });

  // ---------- 规则 2：同一编号再次入库必须拦截 ----------
  it('同一编号重复入库返回 409', async () => {
    const res = await intake();
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/重复入库|已存在/);
  });

  // ---------- 规则 3：凭证分列新装/旧件，一件一凭证 ----------
  it('开具凭证，凭证同时含新装电瓶与回收旧件', async () => {
    const res = await http.post('/api/receipts').send({
      oldBatterySerial: 'OLD-TEST-001',
      customerName: '张三',
      vehiclePlate: '沪A·10001',
      newBatteryBrand: '风帆',
      newBatteryModel: '12V-60Ah',
      newBatterySerial: 'NEW-SN-001',
      operator: '店员小王',
    });
    expect(res.status).toBe(201);
    expect(res.body.receiptNo).toMatch(/^HS-/);
    expect(res.body.newBatterySerial).toBe('NEW-SN-001');
    expect(res.body.oldBatterySerial).toBe('OLD-TEST-001');
    expect(res.body.oldWeightKg).toBe(15.5);
  });

  it('同一旧件重复开凭证返回 409', async () => {
    const res = await http
      .post('/api/receipts')
      .send({
        oldBatterySerial: 'OLD-TEST-001',
        customerName: '张三',
        vehiclePlate: '沪A·10001',
        newBatteryBrand: '瓦尔塔',
        newBatteryModel: '12V-70Ah',
        newBatterySerial: 'NEW-SN-002',
        operator: '店员小王',
      });
    expect(res.status).toBe(409);
  });

  // ---------- 规则 4：复称保留原重量及新测量值 ----------
  it('复称同时保留原重量与新测量值', async () => {
    const res = await http
      .post('/api/batteries/OLD-TEST-001/reweigh')
      .send({ newWeightKg: 14.9, operator: '店员小李', reason: '例行复称' });
    expect(res.status).toBe(201);
    expect(res.body.previousWeightKg).toBe(15.5);
    expect(res.body.newWeightKg).toBe(14.9);

    const detail = await http.get('/api/batteries/OLD-TEST-001').expect(200);
    expect(detail.body.weightKg).toBe(14.9); // 当前重量更新
    expect(detail.body.weightRecords).toHaveLength(1);
    expect(detail.body.weightRecords[0].previousWeightKg).toBe(15.5); // 原值保留

    // 凭证是快照，不随后续复称改变
    const receipts = await http.get('/api/receipts').expect(200);
    const mine = receipts.body.find(
      (r: { oldBatterySerial: string }) => r.oldBatterySerial === 'OLD-TEST-001',
    );
    expect(mine.oldWeightKg).toBe(15.5);
  });

  // ---------- 规则 5：发货 → 一致签收 ----------
  it('不能把不存在或已发出的旧件重复发货', async () => {
    const res = await http.post('/api/dispatches').send({
      recyclerName: '绿源公司',
      operator: '店员小王',
      serialNumbers: ['OLD-TEST-001', 'OLD-GHOST-000'],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('OLD-GHOST-000');
  });

  it('发货建立批次并逐件关联', async () => {
    const res = await http.post('/api/dispatches').send({
      recyclerName: '绿源公司',
      operator: '店员小王',
      serialNumbers: ['OLD-TEST-001'],
      note: '本周第一批',
    });
    expect(res.status).toBe(201);
    expect(res.body.shippedCount).toBe(1);
    expect(res.body.status).toBe('SHIPPED');
    expect(res.body.items).toHaveLength(1);

    // 旧件状态推进
    const b = await http.get('/api/batteries/OLD-TEST-001').expect(200);
    expect(b.body.status).toBe('DISPATCHED');

    // 再次发货同一件被拦截
    const again = await http.post('/api/dispatches').send({
      recyclerName: '绿源公司',
      operator: '店员小王',
      serialNumbers: ['OLD-TEST-001'],
    });
    expect(again.status).toBe(409);
  });

  it('数量一致的签收回执：批次完成，旧件标记实收', async () => {
    const batches = await http.get('/api/dispatches').expect(200);
    const id = batches.body[0].id;

    const res = await http.post(`/api/dispatches/${id}/acknowledge`).send({
      receivedCount: 1,
      signedBy: '回收商老赵',
      signatureData: 'data:image/png;base64,SIGNATURE_SIM',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACKNOWLEDGED');
    expect(res.body.differenceCount).toBe(0);

    const b = await http.get('/api/batteries/OLD-TEST-001').expect(200);
    expect(b.body.status).toBe('ACKNOWLEDGED');
  });

  // ---------- 规则 6：重复签收回执只能记一次 ----------
  it('同一批次重复签收返回 409，回执仍只有一条', async () => {
    const batches = await http.get('/api/dispatches').expect(200);
    const id = batches.body[0].id;

    const res = await http.post(`/api/dispatches/${id}/acknowledge`).send({
      receivedCount: 1,
      signedBy: '回收商老孙',
      signatureData: 'data:image/png;base64,SIGNATURE_2',
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/只能记一次|已签收/);

    const detail = await http.get(`/api/dispatches/${id}`).expect(200);
    expect(detail.body.acknowledgment.signedBy).toBe('回收商老赵'); // 仍是第一次
  });

  // ---------- 规则 7：数量不符 → 待核实 + 保留差额，不改成一致 ----------
  it('实收数与发出数不符：标记待核实并保留差额', async () => {
    // 再入库 3 件并发货
    for (let i = 2; i <= 4; i++) {
      const sn = `OLD-DIFF-${String(i).padStart(3, '0')}`;
      const r = await intake({ serialNumber: sn, vehiclePlate: `沪C·${i}000${i}`, weightKg: 16 + i });
      expect(r.status).toBe(201);
    }
    const ship = await http.post('/api/dispatches').send({
      recyclerName: '赤金回收',
      operator: '店员小王',
      serialNumbers: ['OLD-DIFF-002', 'OLD-DIFF-003', 'OLD-DIFF-004'],
    });
    expect(ship.status).toBe(201);
    expect(ship.body.shippedCount).toBe(3);
    const batchId = ship.body.id;

    // 回收商只报收到 2 件
    const ack = await http.post(`/api/dispatches/${batchId}/acknowledge`).send({
      receivedCount: 2,
      receivedSerials: ['OLD-DIFF-002', 'OLD-DIFF-003'],
      signedBy: '回收商老钱',
      signatureData: 'sig-diff',
      note: '少一件，运输途中待查',
    });
    expect(ack.status).toBe(201);
    expect(ack.body.status).toBe('PENDING_RECONCILIATION');
    expect(ack.body.shippedCount).toBe(3);
    expect(ack.body.receivedCount).toBe(2);
    expect(ack.body.differenceCount).toBe(1); // 差额保留

    // 逐件标记：002/003 收到，004 未收到
    const items = ack.body.items as Array<{
      battery: { serialNumber: string };
      received: boolean;
    }>;
    const bySerial = Object.fromEntries(
      items.map((i) => [i.battery.serialNumber, i.received]),
    );
    expect(bySerial['OLD-DIFF-002']).toBe(true);
    expect(bySerial['OLD-DIFF-003']).toBe(true);
    expect(bySerial['OLD-DIFF-004']).toBe(false);

    // 未收到件的状态没有被提前推进
    const b4 = await http.get('/api/batteries/OLD-DIFF-004').expect(200);
    expect(b4.body.status).toBe('DISPATCHED');

    // 再次读取，数字没有被系统"自动改成一致"
    const again = await http.get(`/api/dispatches/${batchId}`).expect(200);
    expect(again.body.receivedCount).toBe(2);
    expect(again.body.differenceCount).toBe(1);
  });

  it('编号数多于填报实收数时拒绝（数据自洽校验），且失败不占用唯一回执', async () => {
    for (const sn of ['OLD-CHECK-010', 'OLD-CHECK-011']) {
      const r = await intake({ serialNumber: sn, vehiclePlate: `沪D·${sn.slice(-3)}`, weightKg: 17 });
      expect(r.status).toBe(201);
    }
    const ship = await http.post('/api/dispatches').send({
      recyclerName: '校验回收',
      operator: '店员小王',
      serialNumbers: ['OLD-CHECK-010', 'OLD-CHECK-011'],
    });
    expect(ship.status).toBe(201);
    const batchId = ship.body.id;

    // 声称只收到 1 件，却上报 2 个编号 → 拒绝
    const bad = await http.post(`/api/dispatches/${batchId}/acknowledge`).send({
      receivedCount: 1,
      receivedSerials: ['OLD-CHECK-010', 'OLD-CHECK-011'],
      signedBy: '回收商老周',
      signatureData: 'sig-bad',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toContain('多于');

    // 不属于本批次的编号也拒绝
    const alien = await http.post(`/api/dispatches/${batchId}/acknowledge`).send({
      receivedCount: 1,
      receivedSerials: ['OLD-TEST-001'],
      signedBy: '回收商老周',
      signatureData: 'sig-alien',
    });
    expect(alien.status).toBe(400);
    expect(alien.body.message).toContain('不属于本批次');

    // 前两次失败均未写入回执，仍可正常签收
    const ok = await http.post(`/api/dispatches/${batchId}/acknowledge`).send({
      receivedCount: 1,
      receivedSerials: ['OLD-CHECK-010'],
      signedBy: '回收商老周',
      signatureData: 'sig-ok',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('PENDING_RECONCILIATION');
    expect(ok.body.differenceCount).toBe(1);
  });

  // ---------- 规则 8：沿编号查看去向 ----------
  it('去向时间线完整呈现入库/复称/发货/签收与待核实', async () => {
    const trace = await http.get('/api/trace/OLD-DIFF-004').expect(200);
    expect(trace.body.receiptIssued).toBe(false);
    const stages = trace.body.events.map((e: { stage: string }) => e.stage);
    expect(stages).toContain('INTAKE');
    expect(stages).not.toContain('RECEIPT_ISSUED'); // 未开凭证不出现伪造的凭证事件
    expect(stages).toContain('DISPATCHED');
    expect(stages).toContain('ACKNOWLEDGED');

    const pendingEvent = trace.body.events.find(
      (e: { title: string }) => e.title.includes('待核实'),
    );
    expect(pendingEvent).toBeTruthy();
    expect(pendingEvent.detail).toContain('差额 1');
    expect(trace.body.batch.status).toBe('PENDING_RECONCILIATION');
    expect(trace.body.batch.differenceCount).toBe(1);
  });

  it('已一致完成的旧件去向显示闭环', async () => {
    const trace = await http.get('/api/trace/OLD-TEST-001').expect(200);
    expect(trace.body.status).toBe('ACKNOWLEDGED');
    const titles = trace.body.events.map((e: { title: string }) => e.title);
    expect(titles.some((t: string) => t.includes('凭证'))).toBe(true);
    expect(titles.some((t: string) => t.includes('回收商确认收到'))).toBe(true);
  });

  it('查询不存在的编号返回 404', async () => {
    await http.get('/api/trace/NOT-EXIST').expect(404);
  });
});
