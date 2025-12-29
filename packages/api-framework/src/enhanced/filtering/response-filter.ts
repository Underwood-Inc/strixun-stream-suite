/**
 * Enhanced API Framework - Response Filtering Middleware
 * 
 * Filters response fields based on query parameters and type definitions
 */

import type {
  ResponseFilterConfig,
  TypeDefinition,
  FilteringParams,
} from '../types';
import type { APIRequest, APIResponse } from '../../types';

/**
 * Parse filtering parameters from request
 */
export function parseFilteringParams(request: APIRequest): FilteringParams {
  const url = new URL(request.url || `http://localhost${request.path}`);
  const params: FilteringParams = {};

  // Parse include
  const includeParam = url.searchParams.get('include');
  if (includeParam) {
    params.include = includeParam.split(',').map(s => s.trim());
  }

  // Parse exclude
  const excludeParam = url.searchParams.get('exclude');
  if (excludeParam) {
    params.exclude = excludeParam.split(',').map(s => s.trim());
  }

  // Parse tags
  const tagsParam = url.searchParams.get('tags');
  if (tagsParam) {
    params.tags = tagsParam.split(',').map(s => s.trim());
  }

  return params;
}

/**
 * Get fields for a tag
 */
function getTagFields(tag: string, config: ResponseFilterConfig): string[] {
  return config.tags[tag] || [];
}

/**
 * Filter object based on field paths
 */
function filterObject(
  obj: any,
  includePaths: string[],
  excludePaths: string[]
): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = {};
  const includeSet = new Set(includePaths);
  const excludeSet = new Set(excludePaths);

  for (const key in obj) {
    // Check if excluded
    if (excludeSet.has(key)) {
      continue;
    }

    // Check if included (or no include filter means include all)
    if (includePaths.length === 0 || includeSet.has(key)) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Get type definition for endpoint
 */
function getTypeDefinition(
  request: APIRequest,
  config: ResponseFilterConfig
): TypeDefinition | null {
  // Try to match endpoint to type definition
  const path = request.path || new URL(request.url || '').pathname;
  
  for (const [typeName, typeDef] of config.typeDefinitions.entries()) {
    // Simple matching - can be enhanced with route matching
    if (path.includes(typeName.toLowerCase()) || path.includes(typeName)) {
      return typeDef;
    }
  }

  return null;
}

/**
 * Apply filtering to response data
 */
export function applyFiltering(
  data: any,
  params: FilteringParams,
  config: ResponseFilterConfig,
  typeDef?: TypeDefinition
): any {
  // Start with root config always-included fields
  const alwaysInclude = config.rootConfig.alwaysInclude;
  const defaultInclude = config.rootConfig.defaultInclude || [];

  // Build include list
  let includePaths: string[] = [...alwaysInclude];

  // Add default include if no explicit include
  if (!params.include || params.include.length === 0) {
    includePaths.push(...defaultInclude);
  } else {
    includePaths.push(...params.include);
  }

  // Add tag fields
  if (params.tags) {
    for (const tag of params.tags) {
      const tagFields = getTagFields(tag, config);
      includePaths.push(...tagFields);
    }
  }

  // Add type definition fields
  if (typeDef) {
    // Add required fields (always included)
    includePaths.push(...typeDef.required);

    // Add optional fields if requested
    if (params.include) {
      for (const field of params.include) {
        if (typeDef.optional.includes(field)) {
          includePaths.push(field);
        }
      }
    }
  }

  // Remove duplicates
  includePaths = [...new Set(includePaths)];

  // Build exclude list
  const excludePaths = params.exclude || [];

  // Filter the data
  return filterObject(data, includePaths, excludePaths);
}

/**
 * Create response filtering middleware
 */
export function createResponseFilterMiddleware(
  config: ResponseFilterConfig
) {
  return async (
    request: APIRequest,
    next: (request: APIRequest) => Promise<APIResponse>
  ): Promise<APIResponse> => {
    // Execute request
    const response = await next(request);

    // Only filter successful JSON responses
    if (response.status >= 400) {
      return response;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return response;
    }

    try {
      // Parse response data
      const data = response.data;

      // Parse filtering parameters
      const params = parseFilteringParams(request);

      // Get type definition if available
      const typeDef = getTypeDefinition(request, config);

      // Apply filtering
      const filteredData = applyFiltering(data, params, config, typeDef || undefined);

      // Create new response with filtered data
      return {
        ...response,
        data: filteredData,
      };
    } catch (error) {
      console.error('Response filtering failed:', error);
      // Return original response if filtering fails
      return response;
    }
  };
}

