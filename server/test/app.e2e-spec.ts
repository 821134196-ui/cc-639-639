import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('旧电瓶回收凭证与去向追踪 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.receiptItem.deleteMany();
    await prisma.receipt.deleteMany();
    await prisma.shipmentItem.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.voucher.deleteMany();
    await prisma.weighing.deleteMany();
    await prisma.intake.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const intake = (serialNo: string, weightKg = 18) => ({
    serialNo,
    vehiclePlate: '沪A·D12345',
    ownerName: '张三',
    ownerPhone: '13800000000',
    weightKg,
    physicalVerified: true,
  });

  const post = (path: string, body: object) => request(app.getHttpServer()).post(path).send(body);
  const get = (path: string) => request(app.getHttpServer()).get(path);

  describe('规则一：没有收到实物不能开回收凭证', () => {
    it('未核实实物 → 拒绝登记入库', async () => {
      const res = await post('/api/intakes', { ...intake('BAT-001'), physicalVerified: false });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('实物');
      expect(await prisma.intake.count()).toBe(0);
    });

    it('旧件未入库 → 不能开凭证', async () => {
      const res = await post('/api/vouchers', {
        serialNo: 'GHOST-001',
        newBatteryModel: '骆驼 6-QW-60',
        newBatterySerial: 'NB-1',
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('实物');
      expect(await prisma.voucher.count()).toBe(0);
    });

    it('核实实物入库后 → 可开凭证，且凭证同时列出新装电瓶与回收旧件', async () => {
      await post('/api/intakes', intake('BAT-001', 18.2)).expect(201);
      const res = await post('/api/vouchers', {
        serialNo: 'BAT-001',
        newBatteryModel: '骆驼 6-QW-60',
        newBatterySerial: 'NB-1001',
      }).expect(201);
      expect(res.body.alreadyIssued).toBe(false);
      expect(res.body.voucher.voucherNo).toBeTruthy();
      expect(res.body.voucher.newBatteryModel).toContain('骆驼');
      expect(res.body.voucher.intake.serialNo).toBe('BAT-001');
      expect(res.body.voucher.intake.currentWeightKg).toBeCloseTo(18.2);
    });
  });

  describe('规则二：同一编号再次入库须拦截', () => {
    it('重复入库 → 409，且库里仍只有一条', async () => {
      await post('/api/intakes', intake('BAT-002')).expect(201);
      const res = await post('/api/intakes', intake('BAT-002'));
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('BAT-002');
      expect(await prisma.intake.count({ where: { serialNo: 'BAT-002' } })).toBe(1);
    });
  });

  describe('规则三：回执重复只记一次；数量不符保留差额待核实', () => {
    async function shippedTwo() {
      await post('/api/intakes', intake('BAT-101', 18)).expect(201);
      await post('/api/intakes', intake('BAT-102', 19.5)).expect(201);
      const res = await post('/api/shipments', {
        recyclerName: '绿源回收',
        serialNos: ['BAT-101', 'BAT-102'],
      }).expect(201);
      return res.body;
    }

    it('重复签收回执只记一次；全部相符 → 批次确认、旧件实收', async () => {
      const shipment = await shippedTwo();
      const payload = {
        shipmentId: shipment.id,
        receiptNo: 'RCPT-0001',
        signerName: '李回收',
        items: [
          { serialNo: 'BAT-101', receivedWeightKg: 18 },
          { serialNo: 'BAT-102', receivedWeightKg: 19.5 },
        ],
      };
      const first = await post('/api/receipts', payload).expect(201);
      expect(first.body.duplicate).toBe(false);
      expect(first.body.receipt.signatureData).toMatch(/^SIG-/);

      const second = await post('/api/receipts', payload).expect(201);
      expect(second.body.duplicate).toBe(true);
      expect(second.body.receipt.id).toBe(first.body.receipt.id);
      expect(await prisma.receipt.count({ where: { receiptNo: 'RCPT-0001' } })).toBe(1);
      expect(await prisma.receiptItem.count()).toBe(2);

      const s = (await get(`/api/shipments/${shipment.id}`)).body;
      expect(s.status).toBe('CONFIRMED');
      const track = (await get('/api/tracking/BAT-101')).body;
      expect(track.intake.status).toBe('RECEIVED');
    });

    it('实收数量/重量不符 → 待核实，差额保留，发出数不被改动，仍可沿编号核对去向', async () => {
      const shipment = await shippedTwo();
      // 回收商只签收 BAT-101 且重量少了 0.8kg；BAT-102 未出现在回执中
      const res = await post('/api/receipts', {
        shipmentId: shipment.id,
        receiptNo: 'RCPT-0002',
        signerName: '李回收',
        items: [{ serialNo: 'BAT-101', receivedWeightKg: 17.2 }],
      }).expect(201);

      const receipt = res.body.receipt;
      const item101 = receipt.items.find((i: any) => i.intake.serialNo === 'BAT-101');
      const item102 = receipt.items.find((i: any) => i.intake.serialNo === 'BAT-102');
      expect(item101.matchStatus).toBe('MISMATCH');
      expect(item101.receivedWeightKg).toBeCloseTo(17.2);
      expect(item102.matchStatus).toBe('MISSING');
      expect(item102.receivedWeightKg).toBeNull();

      // 批次待核实；发出数保留未被改成一致
      const s = (await get(`/api/shipments/${shipment.id}`)).body;
      expect(s.status).toBe('PENDING_VERIFICATION');
      const sent101 = s.items.find((i: any) => i.intake.serialNo === 'BAT-101');
      expect(sent101.sentWeightKg).toBeCloseTo(18);

      // 沿编号追踪真实去向：待核实 + 差额
      const track = (await get('/api/tracking/BAT-101')).body;
      expect(track.intake.status).toBe('DISPUTED');
      expect(track.intake.currentWeightKg).toBeCloseTo(18); // 门店记录不被实收数改写
      const receiptEvent = track.timeline.find((e: any) => e.stage === 'RECEIPT');
      expect(receiptEvent.matchStatus).toBe('MISMATCH');
      expect(receiptEvent.sentWeightKg).toBeCloseTo(18);
      expect(receiptEvent.receivedWeightKg).toBeCloseTo(17.2);
      expect(receiptEvent.diffKg).toBeCloseTo(-0.8);

      const track102 = (await get('/api/tracking/BAT-102')).body;
      expect(track102.receiptItem.matchStatus).toBe('MISSING');

      // 待核实列表能查到该批次
      const disc = (await get('/api/shipments/discrepancies')).body;
      expect(disc.length).toBe(1);
      expect(disc[0].shipmentNo).toBe(shipment.shipmentNo);
    });

    it('回执包含未发出的编号 → 拒绝', async () => {
      const shipment = await shippedTwo();
      const res = await post('/api/receipts', {
        shipmentId: shipment.id,
        receiptNo: 'RCPT-0003',
        signerName: '李回收',
        items: [{ serialNo: 'BAT-999', receivedWeightKg: 10 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('BAT-999');
    });
  });

  describe('复称：保存原重量及新测量值', () => {
    it('复称后保留初始重量与复称记录，可沿编号追溯', async () => {
      const created = (await post('/api/intakes', intake('BAT-201', 17.5)).expect(201)).body;
      const res = await post(`/api/intakes/${created.id}/reweigh`, {
        newWeightKg: 17.9,
        reason: '回收商要求复称',
      }).expect(201);
      expect(res.body.weighing.originalWeightKg).toBeCloseTo(17.5);
      expect(res.body.weighing.newWeightKg).toBeCloseTo(17.9);
      expect(res.body.intake.currentWeightKg).toBeCloseTo(17.9);
      expect(res.body.intake.initialWeightKg).toBeCloseTo(17.5);

      const track = (await get('/api/tracking/BAT-201')).body;
      expect(track.intake.weighings.length).toBe(1);
      expect(track.timeline.some((e: any) => e.stage === 'REWEIGH')).toBe(true);
    });
  });

  it('未入库编号追踪 → 404', async () => {
    await get('/api/tracking/NOPE-1').expect(404);
  });
});
