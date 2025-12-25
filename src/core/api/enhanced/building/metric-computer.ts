/**
 * Enhanced API Framework - Metric Computer
 * 
 * On-demand metric computation with caching support
 */

import type {
  MetricDefinition,
  RequestContext,
} from '../types';

/**
 * Compute a single metric
 */
export async function computeMetric(
  metricDef: MetricDefinition,
  data: any,
  context: RequestContext
): Promise<any> {
  // Check cache if available
  if (metricDef.cache) {
    const cacheKey = metricDef.cache.key(data);
    const cached = await getCachedMetric(cacheKey, context);
    if (cached !== null) {
      return cached;
    }
  }

  // Compute metric
  const value = await metricDef.compute(data, context);

  // Cache if available
  if (metricDef.cache && value !== undefined && value !== null) {
    const cacheKey = metricDef.cache.key(data);
    await setCachedMetric(cacheKey, value, metricDef.cache.ttl, context);
  }

  return value;
}

/**
 * Compute multiple metrics
 */
export async function computeMetrics(
  metrics: Record<string, MetricDefinition>,
  data: any,
  context: RequestContext,
  requestedMetrics?: string[]
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  // If specific metrics requested, only compute those
  const metricsToCompute = requestedMetrics
    ? requestedMetrics.filter(name => name in metrics)
    : Object.keys(metrics);

  // Compute all requested metrics
  for (const metricName of metricsToCompute) {
    const metricDef = metrics[metricName];
    
    // Skip if not required and not requested
    if (!metricDef.required && requestedMetrics && !requestedMetrics.includes(metricName)) {
      continue;
    }

    try {
      results[metricName] = await computeMetric(metricDef, data, context);
    } catch (error) {
      console.error(`Failed to compute metric ${metricName}:`, error);
      // Continue with other metrics
    }
  }

  return results;
}

/**
 * Get cached metric value
 */
async function getCachedMetric(
  cacheKey: string,
  context: RequestContext
): Promise<any | null> {
  if (!context.env?.CACHE_KV) {
    // No KV available, return null (no cache)
    return null;
  }

  try {
    const cached = await context.env.CACHE_KV.get(cacheKey, { type: 'json' });
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }

  return null;
}

/**
 * Set cached metric value
 */
async function setCachedMetric(
  cacheKey: string,
  value: any,
  ttl: number,
  context: RequestContext
): Promise<void> {
  if (!context.env?.CACHE_KV) {
    // No KV available, skip caching
    return;
  }

  try {
    await context.env.CACHE_KV.put(
      cacheKey,
      JSON.stringify(value),
      { expirationTtl: ttl }
    );
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Clear cached metric
 */
export async function clearCachedMetric(
  cacheKey: string,
  context: RequestContext
): Promise<void> {
  if (!context.env?.CACHE_KV) {
    return;
  }

  try {
    await context.env.CACHE_KV.delete(cacheKey);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Generate cache key for metric
 */
export function generateMetricCacheKey(
  metricName: string,
  dataId: string,
  additionalContext?: Record<string, string>
): string {
  const parts = ['metric', metricName, dataId];
  
  if (additionalContext) {
    const contextStr = Object.entries(additionalContext)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|');
    parts.push(contextStr);
  }

  return parts.join(':');
}

