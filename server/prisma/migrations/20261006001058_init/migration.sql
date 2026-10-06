-- CreateTable
CREATE TABLE "OldBattery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serialNumber" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "vehicleModel" TEXT,
    "customerName" TEXT,
    "weightKg" REAL NOT NULL,
    "physicalVerifiedAt" DATETIME NOT NULL,
    "intakeOperator" TEXT NOT NULL,
    "intakeNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batteryId" INTEGER NOT NULL,
    "previousWeightKg" REAL NOT NULL,
    "newWeightKg" REAL NOT NULL,
    "operator" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightRecord_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "OldBattery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecyclingReceipt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "receiptNo" TEXT NOT NULL,
    "batteryId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "newBatteryBrand" TEXT NOT NULL,
    "newBatteryModel" TEXT NOT NULL,
    "newBatterySerial" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL,
    "oldBatterySerial" TEXT NOT NULL,
    "oldWeightKg" REAL NOT NULL,
    "operator" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecyclingReceipt_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "OldBattery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DispatchBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchNo" TEXT NOT NULL,
    "recyclerName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SHIPPED',
    "shippedCount" INTEGER NOT NULL,
    "receivedCount" INTEGER,
    "differenceCount" INTEGER,
    "note" TEXT,
    "dispatchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME
);

-- CreateTable
CREATE TABLE "DispatchItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "batchId" INTEGER NOT NULL,
    "batteryId" INTEGER NOT NULL,
    "received" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DispatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DispatchBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DispatchItem_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "OldBattery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DispatchAcknowledgment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dispatchId" INTEGER NOT NULL,
    "receivedCount" INTEGER NOT NULL,
    "receivedSerials" TEXT NOT NULL,
    "signedBy" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "note" TEXT,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DispatchAcknowledgment_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "DispatchBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OldBattery_serialNumber_key" ON "OldBattery"("serialNumber");

-- CreateIndex
CREATE INDEX "WeightRecord_batteryId_idx" ON "WeightRecord"("batteryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecyclingReceipt_receiptNo_key" ON "RecyclingReceipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "RecyclingReceipt_batteryId_key" ON "RecyclingReceipt"("batteryId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchBatch_batchNo_key" ON "DispatchBatch"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchItem_batteryId_key" ON "DispatchItem"("batteryId");

-- CreateIndex
CREATE INDEX "DispatchItem_batchId_idx" ON "DispatchItem"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchAcknowledgment_dispatchId_key" ON "DispatchAcknowledgment"("dispatchId");
