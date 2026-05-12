import { createHash } from "node:crypto";
import { handlePaymentNotify } from "../modules/payment/service";
import { getOrderForQuery } from "../modules/order/service";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function signBepusdt(payload: Record<string, string | number>, secret: string) {
  const base = Object.entries(payload)
    .filter(([, value]) => value !== "" && value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("md5").update(`${base}${secret}`).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (isObject(expected)) {
    if ("in" in expected) {
      const values = expected.in as unknown[];
      return values.includes(actual);
    }
    if ("notIn" in expected) {
      const values = expected.notIn as unknown[];
      return !values.includes(actual);
    }
    if ("not" in expected) {
      return actual !== expected.not;
    }
    if ("lt" in expected) {
      const expectedTime = new Date(expected.lt as string | Date).getTime();
      const actualTime = actual ? new Date(actual as string | Date).getTime() : Number.NaN;
      return Number.isFinite(actualTime) && actualTime < expectedTime;
    }
  }

  return actual === expected;
}

function matchesWhere(item: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") {
      return (expected as Array<Record<string, unknown>>).some((condition) => matchesWhere(item, condition));
    }

    return matchesValue(item[key], expected);
  });
}

function createMockPrisma() {
  const state = {
    order: {
      id: 1,
      orderNo: "ORD-NOTIFY-1",
      queryToken: "token-1",
      productId: 1,
      productNameSnapshot: "Notify Product",
      unitPrice: 1234,
      quantity: 1,
      amount: 1234,
      paymentProvider: "BEPUSDT",
      paymentStatus: "UNPAID",
      deliveryStatus: "NOT_DELIVERED",
      status: "PENDING",
      paymentOrderNo: null,
      paidAt: null,
      deliveredAt: null,
      deliveryLockToken: null,
      deliveryLockedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    cards: [
      {
        id: 1,
        productId: 1,
        content: "CARD-001-SECRET",
        status: "UNUSED",
        orderId: null,
        soldAt: null,
        deliveryLockToken: null,
      },
    ],
    paymentConfigs: [
      {
        provider: "BEPUSDT",
        name: "USDT",
        isEnabled: true,
        configJson: JSON.stringify({
          baseUrl: "https://bep.example.com",
          appSecret: "secret-token",
          merchantId: "default",
          paymentType: "USDT-TRC20",
          notifyUrl: "/api/payments/bepusdt/notify",
        }),
      },
      {
        provider: "EPAY",
        name: "聚合支付",
        isEnabled: true,
        configJson: JSON.stringify({
          baseUrl: "https://epay.example.com",
          key: "epay-key",
          notifyUrl: "/api/payments/epay/notify",
        }),
      },
    ],
    paymentLogs: [] as any[],
    deliveries: [] as any[],
  };

  const prisma = {
    paymentConfig: {
      async findMany() {
        return state.paymentConfigs;
      },
      async findUnique({ where }: any) {
        return state.paymentConfigs.find((item) => item.provider === where.provider) ?? null;
      },
    },
    paymentLog: {
      async create({ data }: any) {
        state.paymentLogs.push(data);
        return data;
      },
    },
    telegramConfig: {
      async findFirst() {
        return null;
      },
    },
    order: {
      async findUnique({ where, include }: any) {
        if (where.orderNo && where.orderNo !== state.order.orderNo) return null;
        if (where.id && where.id !== state.order.id) return null;

        if (include) {
          return {
            ...state.order,
            product: { id: 1, slug: "notify-product", name: "Notify Product" },
            deliveries: state.deliveries,
            cards: state.cards.filter((item) => item.orderId === state.order.id),
            paymentLogs: state.paymentLogs,
          };
        }

        return { ...state.order };
      },
      async update({ where, data }: any) {
        assert(where.orderNo === state.order.orderNo || where.id === state.order.id, "unexpected order update target");
        Object.assign(state.order, data);
        return { ...state.order };
      },
      async updateMany({ where, data }: any) {
        if (!matchesWhere(state.order as any, where)) {
          return { count: 0 };
        }

        Object.assign(state.order, data);
        return { count: 1 };
      },
    },
    card: {
      async findMany({ where, take }: any) {
        return state.cards
          .filter((item) => matchesWhere(item as any, where))
          .slice(0, take)
          .map((item) => ({ ...item }));
      },
      async update({ where, data }: any) {
        const card = state.cards.find((item) => item.id === where.id);
        assert(card, "card not found");
        const existingCard = card!;
        Object.assign(existingCard, data);
        return { ...existingCard };
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const card of state.cards) {
          if (!matchesWhere(card as any, where)) continue;
          Object.assign(card, data);
          count += 1;
        }
        return { count };
      },
    },
    orderDelivery: {
      async findFirst({ where, orderBy }: any) {
        const items = state.deliveries.filter((item) => matchesWhere(item, where));
        if (orderBy?.[0]?.id === "asc") {
          items.sort((left, right) => left.id - right.id);
        }
        return items[0] ? { ...items[0] } : null;
      },
      async deleteMany({ where }: any) {
        const before = state.deliveries.length;
        state.deliveries = state.deliveries.filter((item) => !matchesWhere(item, where));
        return { count: before - state.deliveries.length };
      },
      async create({ data }: any) {
        const record = { id: state.deliveries.length + 1, ...data };
        state.deliveries.push(record);
        return record;
      },
    },
    async $transaction(callback: any) {
      return callback(prisma);
    },
  };

  return { prisma: prisma as any, state };
}

async function verifySuccessAndIdempotency() {
  const { prisma, state } = createMockPrisma();
  const payload = {
    trade_id: "trade_notify_1",
    order_id: "ORD-NOTIFY-1",
    amount: "12.34",
    actual_amount: "1.88",
    token: "USDT",
    block_transaction_id: "tx_hash_1",
    status: "2",
  };

  const signed = {
    ...payload,
    signature: signBepusdt(payload, "secret-token"),
  };

  const first = await handlePaymentNotify("BEPUSDT", signed, prisma, "notify");
  assert(first.ok, "first notify should succeed");
  assert(state.order.paymentStatus === "PAID", "order should be marked paid");
  assert(state.order.deliveryStatus === "DELIVERED", "order should be delivered");
  assert(state.deliveries.length === 1, "delivery should be created once");

  const second = await handlePaymentNotify("BEPUSDT", signed, prisma, "notify");
  assert(second.ok, "second notify should still return ok");
  assert(state.deliveries.length === 1, "duplicate notify should not redeliver");
}

async function verifyAmountMismatch() {
  const { prisma, state } = createMockPrisma();
  const payload = {
    trade_id: "trade_notify_2",
    order_id: "ORD-NOTIFY-1",
    amount: "88.88",
    actual_amount: "9.99",
    token: "USDT",
    block_transaction_id: "tx_hash_2",
    status: "2",
  };

  const signed = {
    ...payload,
    signature: signBepusdt(payload, "secret-token"),
  };

  const result = await handlePaymentNotify("BEPUSDT", signed, prisma, "notify");
  assert(!result.ok, "amount mismatch notify should fail");
  assert(state.order.paymentStatus === "UNPAID", "order payment status should stay unpaid");
  assert(state.deliveries.length === 0, "amount mismatch should not deliver");
}

async function verifyPaidOrderQueryRecoversDelivery() {
  const { prisma, state } = createMockPrisma();
  state.order.status = "PAID";
  state.order.paymentStatus = "PAID";
  state.order.deliveryStatus = "NOT_DELIVERED";
  (state.order as any).paidAt = new Date();

  const result = await getOrderForQuery(state.order.orderNo, state.order.queryToken, undefined, prisma);
  assert(result?.paymentStatus === "PAID", "query should return paid status");
  assert(result?.deliveryStatus === "DELIVERED", "query should recover delivery for paid orders");
  assert(result?.deliveryContents.includes("CARD-001-SECRET"), "query should return delivered card content");
}

async function verifyDeliveredOrderQueryDoesNotRedeliver() {
  const { prisma, state } = createMockPrisma();
  state.order.status = "PAID";
  state.order.paymentStatus = "PAID";
  state.order.deliveryStatus = "NOT_DELIVERED";
  (state.order as any).paidAt = new Date();
  state.cards[0].status = "SOLD";
  (state.cards[0] as any).orderId = state.order.id;
  state.deliveries.push({
    id: 1,
    orderId: state.order.id,
    deliveryType: "CARD",
    contentSnapshot: JSON.stringify(["CARD-001-SECRET"]),
    status: "SUCCESS",
  });

  const result = await getOrderForQuery(state.order.orderNo, state.order.queryToken, undefined, prisma);
  assert(result?.deliveryStatus === "DELIVERED", "query should reconcile existing successful delivery");
  assert(state.deliveries.length === 1, "query should not create another delivery record");
  assert(state.cards.filter((item) => item.orderId === state.order.id).length === 1, "query should not allocate extra cards");
}

await verifySuccessAndIdempotency();
await verifyAmountMismatch();
await verifyPaidOrderQueryRecoversDelivery();
await verifyDeliveredOrderQueryDoesNotRedeliver();

console.log("Payment notify verification passed.");
