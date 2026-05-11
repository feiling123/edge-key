import { getOrderForEmailQuery, getOrderForQuery } from "../../modules/order/service";

export async function onQueryOrder(input: { orderNo: string; queryToken?: string; email?: string }) {
  if (input.queryToken) {
    return getOrderForQuery(input.orderNo, input.queryToken);
  }

  return getOrderForEmailQuery(input.orderNo, input.email ?? "");
}
