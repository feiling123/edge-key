import { getSiteSetting } from "../../../modules/site/service";
import { generateOrderToken } from "../../../lib/utils/order-token";
import { getProductBySlug } from "../../../modules/catalog/service";
import { notFoundError } from "../../../lib/app-error";

export async function onGenerateOrderToken(input: { productSlug: string }) {
  const [product, siteSettings] = await Promise.all([
    getProductBySlug(input.productSlug),
    getSiteSetting(),
  ]);

  if (!product || product.status !== "ACTIVE") {
    throw notFoundError("商品不存在或未上架", "PRODUCT_NOT_AVAILABLE");
  }

  // 如果未启用下单 token 功能，返回空 token
  if (!siteSettings.enableOrderToken) {
    return {
      token: "",
      enabled: false,
    };
  }

  const token = generateOrderToken(product.id, siteSettings.orderTokenExpiryMin);

  return {
    token,
    enabled: true,
    expiryMin: siteSettings.orderTokenExpiryMin,
  };
}