# 旧电瓶回收凭证与去向追踪系统

汽修店旧电瓶回收管理：车主更换电瓶时拿到旧件回收凭证，门店追踪旧电瓶暂存、发给回收商、以及对方实收数量的全过程。车主和门店都能沿旧件编号查看去向。

## 一条命令启动

```bash
./start.sh
```

首次运行会自动安装依赖、初始化 SQLite 并写入演示数据，随后同时启动：

- 前端：http://localhost:5173
- API：http://localhost:3001/api

依赖已安装过时，直接 `npm run dev` 即可。

## 业务规则

- **没有收到实物不能开回收凭证**：旧件必须先「核实实物 → 登记入库」；未核实实物的登记被拒绝，未入库的编号开不出凭证。
- **同一编号再次入库须拦截**：编号全系统唯一，重复入库返回 409。
- **凭证分别列出新装电瓶与回收旧件**；一件旧件只开一张凭证（重复请求返回原凭证）。
- **暂存 → 发给回收商 → 对方实收**各环节留痕，沿旧件编号可查看完整时间线。
- **实收数与发出数不符 → 待核实**：批次与旧件显示「待核实」，差额保留，发出记录不被改写成一致。
- **复称保存原重量及新测量值**，历史记录可追溯。
- **重复签收回执只记一次**：同一回执号重复提交幂等返回原回执，不重复入账。
- 电子签收为本地模拟：由回执号、签收人、批次生成签名哈希（`SIG-…`）。

## 验证

```bash
npm test
```

e2e 测试（`server/test/app.e2e-spec.ts`，独立测试库）覆盖：

1. 未核实实物 → 拒绝入库；未入库编号 → 开不出凭证；核实入库后凭证同时列出新电瓶与旧件。
2. 同一编号重复入库 → 409，库里仍只有一条。
3. 同一回执号重复签收 → 只记一次；全部相符 → 批次确认、旧件实收。
4. 实收重量不符 / 回执缺件 → 批次与旧件「待核实」，发出数与差额保留，沿编号可核对真实去向。
5. 复称保留原重量与新测量值。

## 技术栈与结构

TypeScript / NestJS / React (Vite) / Prisma / SQLite（`server/prisma/dev.db`）

```
server/                 NestJS API（端口 3001，前缀 /api）
  prisma/schema.prisma  逐件数据模型（Intake/Voucher/Shipment/Receipt/Weighing）
  prisma/seed.ts        幂等演示数据
  src/intake            入库登记、复称
  src/voucher           回收凭证
  src/shipment          发货批次、待核实列表
  src/receipt           回收商签收（回执去重、差额核对）
  src/tracking          沿编号追踪去向
  test/                 e2e 测试
client/                 React 前端（端口 5173，/api 代理到 3001）
```

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/intakes` | 旧件入库（须 `physicalVerified: true`，编号唯一） |
| POST | `/api/intakes/:id/reweigh` | 复称（保留原重量与新值） |
| POST | `/api/vouchers` | 开回收凭证（旧件须已核实入库） |
| POST | `/api/shipments` | 创建发货批次（仅暂存中旧件） |
| POST | `/api/receipts` | 回收商签收（同一回执号只记一次；不符→待核实） |
| GET | `/api/tracking/:serialNo` | 沿旧件编号查看去向时间线 |
| GET | `/api/shipments/discrepancies` | 待核实批次列表 |
