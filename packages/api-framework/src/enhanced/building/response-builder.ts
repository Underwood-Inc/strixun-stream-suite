/**
 * Enhanced API Framework - Type-Based Response Builder
 * 
 * Builds responses with automatic root config inclusion and type safety
 */

import type {
  RootResponseConfig,
  APIResponse,
  TypeDefinition,
  ResponseBuilderOptions,
  BuiltResponse,
  RequestContext,
} from '../types';
import type { APIRequest } from '../../types';
import { computeMetric } from './metric-computer';

/**
 * Build response with automatic root config inclusion
 * 
 * TypeScript ensures root fields are always present via APIResponse<T>
 * This function ensures runtime data matches the type signature
 */
export function buildResponse<T extends Record<string, any>>(
  data: Partial<T>,
  context: RequestContext,
  typeDef?: TypeDefinition,
  options: ResponseBuilderOptions = {}
): BuiltResponse<APIResponse<T>> {
  // Start with root config fields (always included)
  const rootConfig: Partial<RootResponseConfig> = {
    id: data.id || context.customer?.id || generateId(),
    customerId: data.customerId || context.customer?.customerId || '',
  };

  // Ensure root fields are present
  const responseData: Partial<APIResponse<T>> = {
    ...rootConfig,
    ...data,
  };

  // Track what was included/excluded
  const included: string[] = [...Object.keys(rootConfig)];
  const excluded: string[] = [];
  const computed: string[] = [];

  // Apply type definition if provided
  if (typeDef) {
    // Include required fields (from type definition)
    for (const field of typeDef.required) {
      if (!(field in responseData)) {
        // Field is required but missing - set to undefined or throw?
        // For now, we'll include it as undefined (caller should ensure it exists)
        responseData[field as keyof APIResponse<T>] = undefined as any;
      }
      if (!included.includes(field)) {
        included.push(field);
      }
    }

    // Handle optional fields based on options
    if (options.include) {
      for (const field of options.include) {
        if (typeDef.optional.includes(field) && field in data) {
          responseData[field as keyof APIResponse<T>] = data[field];
          if (!included.includes(field)) {
            included.push(field);
          }
        }
      }
    }

    if (options.exclude) {
      for (const field of options.exclude) {
        if (field in responseData && !typeDef.required.includes(field)) {
          delete responseData[field as keyof APIResponse<T>];
          excluded.push(field);
          const index = included.indexOf(field);
          if (index > -1) {
            included.splice(index, 1);
          }
        }
      // Remove from included if it was there
      }
    }

    // Compute metrics if requested
    if (options.computeMetrics && typeDef.metrics) {
      for (const metricName of options.computeMetrics) {
        const metricDef = typeDef.metrics[metricName];
        if (metricDef) {
          try {
            const metricValue = computeMetric(metricDef, data, context);
            responseData[metricName as keyof APIResponse<T>] = metricValue as any;
            computed.push(metricName);
            if (!included.includes(metricName)) {
              included.push(metricName);
            }
          } catch (error) {
            console.error(`Failed to compute metric ${metricName}:`, error);
          }
        }
      }
    }
  }

  return {
    data: responseData as Partial<APIResponse<T>>,
    included,
    excluded,
    computed,
  };
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  // Use crypto.randomUUID if available (Cloudflare Workers, modern browsers)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate response matches type definition
 */
export function validateResponse<T>(
  response: Partial<APIResponse<T>>,
  typeDef: TypeDefinition
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check root config fields
  if (!response.id) {
    errors.push('Missing required root field: id');
  }
  if (!response.customerId) {
    errors.push('Missing required root field: customerId');
  }

  // Check required fields from type definition
  for (const field of typeDef.required) {
    if (!(field in response) || response[field as keyof typeof response] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create response builder middleware
 * 
 * Note: This is primarily for server-side use in Cloudflare Workers
 * For client-side, use buildResponse() directly after receiving the response
 */
export function createResponseBuilderMiddleware<T extends Record<string, any>>(
  typeDef?: TypeDefinition,
  getContext?: (request: APIRequest) => RequestContext
) {
  return async (
    request: APIRequest,
    next: (request: APIRequest) => Promise<any>
  ): Promise<any> => {
    // Get context if provided
    const context = getContext ? getContext(request) : {
      request,
      env: undefined,
    };
    // Execute request
    const response = await next(request);

    // Only build successful JSON responses
    if (!response.ok) {
      return response;
    }

    const contentType = response.headers?.get('content-type');
    if (!contentType?.includes('application/json')) {
      return response;
    }

    try {
      // Parse response data
      const data = await response.json();

      // Parse filtering options from query params
      const url = new URL(request.url || `http://localhost${request.path}`);
      const options: ResponseBuilderOptions = {
        include: url.searchParams.get('include')?.split(',').map(s => s.trim()),
        exclude: url.searchParams.get('exclude')?.split(',').map(s => s.trim()),
        tags: url.searchParams.get('tags')?.split(',').map(s => s.trim()),
        computeMetrics: url.searchParams.get('metrics')?.split(',').map(s => s.trim()),
      };

      // Build response (server-side only - ensures root config is present)
      const built = buildResponse<T>(data, context, typeDef, options);

      // Create new response
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      
      // Add metadata headers
      if (built.computed.length > 0) {
        headers.set('X-Computed-Metrics', built.computed.join(','));
      }

      return {
        ...response,
        data: built.data,
        headers,
      };
    } catch (error) {
      console.error('Response building failed:', error);
      return response;
    }
  };
}

