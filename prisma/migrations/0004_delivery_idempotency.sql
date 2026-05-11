DELETE FROM "OrderDelivery"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "OrderDelivery"
  GROUP BY "orderId", "deliveryType", "status"
);

CREATE UNIQUE INDEX "OrderDelivery_orderId_deliveryType_status_key" ON "OrderDelivery"("orderId", "deliveryType", "status");
