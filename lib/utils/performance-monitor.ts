/**
 * 性能监控和优化工具
 */

import { PERFORMANCE_THRESHOLDS, checkPerformanceLimits } from './performance-limits';

interface PerformanceMetrics {
  startTime: number;
  operation: string;
  context?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * 开始性能监控
   */
  start(operationId: string, operation: string, context?: Record<string, any>): void {
    this.metrics.set(operationId, {
      startTime: Date.now(),
      operation,
      context,
    });
  }

  /**
   * 结束性能监控并检查警告
   */
  end(operationId: string): {
    duration: number;
    warnings: string[];
    shouldOptimize: boolean;
  } {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      return { duration: 0, warnings: [], shouldOptimize: false };
    }

    const duration = Date.now() - metric.startTime;
    this.metrics.delete(operationId);

    // 检查性能阈值
    const result = checkPerformanceLimits({
      queryTimeMs: duration,
    });

    if (result.warnings.length > 0) {
      console.warn(`Performance warning for ${metric.operation}:`, {
        operation: metric.operation,
        duration: `${duration}ms`,
        warnings: result.warnings,
        context: metric.context,
      });
    }

    return {
      duration,
      warnings: result.warnings,
      shouldOptimize: result.shouldOptimize,
    };
  }

  /**
   * 监控数据库查询性能
   */
  async monitorQuery<T>(
    operationId: string,
    operation: string,
    queryFn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    this.start(operationId, operation, context);
    try {
      const result = await queryFn();
      return result;
    } finally {
      this.end(operationId);
    }
  }

  /**
   * 获取内存使用情况 (在 Cloudflare Workers 中有限)
   */
  getMemoryUsage(): number {
    // Cloudflare Workers 没有 process.memoryUsage()
    // 返回估算值或使用其他方法
    return 0;
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

/**
 * 装饰器：自动监控异步函数性能
 */
export function monitorPerformance(operation: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = (async function (this: any, ...args: any[]) {
      const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return performanceMonitor.monitorQuery(
        operationId,
        operation,
        () => originalMethod.apply(this, args),
        { args: args.length }
      );
    } as any) as T;

    return descriptor;
  };
}

/**
 * 批量操作优化：分批处理大量数据
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 50
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const operationId = `batch-${i}-${Date.now()}`;
    
    const batchResults = await performanceMonitor.monitorQuery(
      operationId,
      `batch-process-${batch.length}-items`,
      () => processor(batch),
      { batchIndex: Math.floor(i / batchSize), batchSize: batch.length }
    );
    
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 查询结果缓存 (内存缓存，适合 Cloudflare Workers)
 */
class QueryCache {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private defaultTtl: number = 5 * 60 * 1000; // 5分钟

  set<T>(key: string, data: T, ttl: number = this.defaultTtl): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // 定期清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

export const queryCache = new QueryCache();

/**
 * 带缓存的查询包装器
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // 尝试从缓存获取
  const cached = queryCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // 执行查询并缓存结果
  const result = await queryFn();
  queryCache.set(cacheKey, result, ttl);
  return result;
}