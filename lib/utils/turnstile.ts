import { badRequestError } from "../app-error";

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  error_codes?: string[];
}

/**
 * 验证 Cloudflare Turnstile token
 */
export async function verifyTurnstileToken(token: string, secretKey: string): Promise<boolean> {
  if (!token || !secretKey) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = await response.json() as TurnstileResponse;
    return result.success === true;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}

/**
 * 校验 Turnstile token 并抛出错误（用于服务端验证）
 */
export async function validateTurnstileToken(token: string | undefined, secretKey: string) {
  if (!token) {
    throw badRequestError("缺少人机验证", "TURNSTILE_TOKEN_REQUIRED");
  }
  
  const isValid = await verifyTurnstileToken(token, secretKey);
  if (!isValid) {
    throw badRequestError("人机验证失败，请重试", "TURNSTILE_VERIFICATION_FAILED");
  }
}