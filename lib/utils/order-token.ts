import { badRequestError } from "../app-error";

/**
 * 生成短期下单 token
 * 包含商品ID、时间戳，用于防止跨商品参数篡改和重放攻击
 */
export function generateOrderToken(productId: number, expiryMinutes: number = 5): string {
  const payload = {
    productId,
    timestamp: Date.now(),
    expiry: Date.now() + (expiryMinutes * 60 * 1000),
  };
  
  // 使用简单的编码，避免依赖外部 JWT 库
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 验证短期下单 token
 * 检查商品ID匹配、时间戳有效性
 */
export function verifyOrderToken(token: string, productId: number): boolean {
  if (!token || !token.trim()) {
    return false;
  }

  try {
    // 恢复 base64 编码
    const base64 = token
      .replace(/-/g, '+')
      .replace(/_/g, '/') + 
      '='.repeat((4 - token.length % 4) % 4);
    
    const payload = JSON.parse(atob(base64));
    
    // 验证结构
    if (typeof payload.productId !== 'number' || 
        typeof payload.timestamp !== 'number' || 
        typeof payload.expiry !== 'number') {
      return false;
    }
    
    // 验证商品ID匹配
    if (payload.productId !== productId) {
      return false;
    }
    
    // 验证时间有效性
    const now = Date.now();
    if (now > payload.expiry || now < payload.timestamp) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 校验订单 token 并抛出错误（用于服务端验证）
 */
export function validateOrderToken(token: string | undefined, productId: number) {
  if (!token) {
    throw badRequestError("缺少下单凭证", "ORDER_TOKEN_REQUIRED");
  }
  
  if (!verifyOrderToken(token, productId)) {
    throw badRequestError("下单凭证无效或已过期", "ORDER_TOKEN_INVALID");
  }
}