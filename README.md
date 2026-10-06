# 🔋 旧电瓶回收凭证与去向追踪系统

汽修店场景：车主更换电瓶时取得**旧件回收凭证**；门店追踪旧电瓶**暂存 → 发给回收商 → 对方实收**的逐件去向。

技术栈：TypeScript · NestJS · React · Prisma · SQLite，电子签收为本地 canvas 模拟。

## 一条命令启动

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173 （自动代理 `/api` 到后端）
- 后端：http://localhost:3001 （启动时自动执行 Prisma 迁移、创建 SQLite 库 `server/prisma/data/app.db`）

## 验证测试

```bash
npm test                 # 即 server 工作区的 e2e（自动重建 test.db）
```

## 业务流程（前端六个页签）

1. **入库登记** — 门店核实旧件实物后登记编号、重量、车辆，必须勾选「已当面核实实物」。
2. **回收凭证** — 凭证分两列列出**新装电瓶**与**回收旧件**（旧件重量做快照，后续复称不改变凭证）。
3. **库存与复称** — 复称保存 `原重量 + 新测量值`，当前重量更新、历史保留。
4. **发货与签收** — 勾选暂存旧件生成发给回收商的批次；回收商在回执上手写电子签名，可按编号确认。
5. **去向追踪** — 车主/门店输入旧件编号查看时间线：入库 → 复称 → 凭证 → 发货 → 实收。

## 强制业务规则

| 规则 | 实现 |
| --- | --- |
| 没有核实实物不能登记、不能开凭证 | 入库必须 `physicalVerified=true`（否则 400）；开凭证时查无实物入库记录返回 400 |
| 同一编号再次入库拦截 | `OldBattery.serialNumber` 唯一约束 + 前置查重，冲突返回 409 |
| 一件旧件只能开一张凭证 | `RecyclingReceipt.batteryId` 唯一，重复开具 409 |
| 复称保留原重量与新测量值 | `WeightRecord(previousWeightKg, newWeightKg)` 事务写入 |
| 重复签收回执只能记一次 | `DispatchAcknowledgment.dispatchId` 唯一，重复签收 409，第一次数据不变 |
| 实收数与发出数不符 | 批次置 `PENDING_RECONCILIATION`，保存 `differenceCount`，**绝不改成一致**；可按编号逐件标实收 |
| 编号/数量自洽 | 上报编号数多于实收数、编号不属于本批次均拒绝，且失败不占用唯一回执 |

## 目录结构

```
server/
  prisma/schema.prisma     # OldBattery / WeightRecord / RecyclingReceipt /
                           # DispatchBatch / DispatchItem / DispatchAcknowledgment
  src/batteries/           # 入库、复称
  src/receipts/            # 回收凭证
  src/dispatches/          # 发货批次、电子签收回执
  src/trace/               # 按编号去向时间线
  test/app.e2e-spec.ts     # 16 项规则验证
web/src/panels/            # 六个功能页签
web/src/components/SignaturePad.tsx  # 本地模拟手写电子签名
```

## 主要 API

- `POST /api/batteries/intake` · `POST /api/batteries/:serial/reweigh` · `GET /api/batteries/:serial`
- `POST /api/receipts` · `GET /api/receipts`
- `POST /api/dispatches` · `POST /api/dispatches/:id/acknowledge` · `GET /api/dispatches`
- `GET /api/trace/:serial`
