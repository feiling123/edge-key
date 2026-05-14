/**
 * Cloudflare 免费版性能限制和优化配置
 */

// Cloudflare Workers 免费版限制
export const CLOUDFLARE_LIMITS = {
  // CPU 时间限制 (毫秒)
  CPU_TIME_MS: 10,
  // 内存限制 (MB) 
  MEMORY_MB: 128,
  // 请求超时 (秒)
  REQUEST_TIMEOUT_SEC: 30,
  // D1 查询超时 (秒)
  D1_TIMEOUT_SEC: 30,
  // 单次批量操作最大数量
  MAX_BATCH_SIZE: 100,
} as const;

// 查询优化配置
export const QUERY_LIMITS = {
  // 分页默认大小
  DEFAULT_PAGE_SIZE: 20,
  // 最大分页大小
  MAX_PAGE_SIZE: 100,
  // 批量删除最大数量
  MAX_DELETE_BATCH: 50,
  // 卡密导入最大数量
  MAX_CARD_IMPORT: 1000,
} as const;

// 性能监控阈值
export const PERFORMANCE_THRESHOLDS = {
  // 数据库查询警告阈值 (ms)
  DB_QUERY_WARNING_MS: 100,
  // CPU 使用率警告阈值
  CPU_WARNING_MS: 8,
  // 内存使用警告阈值 (MB)
  MEMORY_WARNING_MB: 100,
} as const;

/**
 * 检查是否接近 Cloudflare 限制
 */
export function checkPerformanceLimits(metrics: {
  cpuTimeMs?: number;
  memoryMB?: number;
  queryTimeMs?: number;
}): {
  warnings: string[];
  shouldOptimize: boolean;
} {
  const warnings: string[] = [];
  let shouldOptimize = false;

  if (metrics.cpuTimeMs && metrics.cpuTimeMs > PERFORMANCE_THRESHOLDS.CPU_WARNING_MS) {
    warnings.push(`CPU time ${metrics.cpuTimeMs}ms approaching limit (${CLOUDFLARE_LIMITS.CPU_TIME_MS}ms)`);
    shouldOptimize = true;
  }

  if (metrics.memoryMB && metrics.memoryMB > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB) {
    warnings.push(`Memory ${metrics.memoryMB}MB approaching limit (${CLOUDFLARE_LIMITS.MEMORY_MB}MB)`);
    shouldOptimize = true;
  }

  if (metrics.queryTimeMs && metrics.queryTimeMs > PERFORMANCE_THRESHOLDS.DB_QUERY_WARNING_MS) {
    warnings.push(`DB query ${metrics.queryTimeMs}ms is slow`);
  }

  return { warnings, shouldOptimize };
}