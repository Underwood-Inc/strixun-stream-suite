/**
 * Human-Friendly Search Query Parser
 * 
 * Supports advanced search syntax:
 * - Quoted exact phrases: "exact phrase"
 * - Space-separated AND terms: term1 term2 (both must match)
 * - Pipe-separated OR groups: term1 | term2 (either must match)
 * - Wildcard prefix matching: term* (matches anything starting with term)
 * 
 * @example
 * // Exact phrase
 * parseSearchQuery('"hello world"') // matches entries containing "hello world"
 * 
 * // AND logic (space-separated)
 * parseSearchQuery('error failed') // matches entries containing both "error" AND "failed"
 * 
 * // OR logic (pipe-separated)
 * parseSearchQuery('error | warning') // matches entries containing "error" OR "warning"
 * 
 * // Combined
 * parseSearchQuery('"connection failed" | timeout error') // matches entries with exact phrase OR both terms
 * 
 * // Wildcard prefix
 * parseSearchQuery('err*') // matches entries containing anything starting with "err" (error, errors, etc.)
 */

export interface SearchQueryResult {
  /** Exact phrases that must be found (from quoted strings) */
  exactPhrases: string[];
  /** OR groups - at least one group must match */
  orGroups: string[][];
  /** Whether the query has any content */
  hasContent: boolean;
}

/**
 * Parse a search query into structured components
 */
export function parseSearchQuery(query: string): SearchQueryResult {
  const trimmed = query.trim();
  
  if (!trimmed) {
    return {
      exactPhrases: [],
      orGroups: [],
      hasContent: false
    };
  }
  
  // Extract quoted exact phrases
  const exactPhrases: string[] = [];
  let processedQuery = trimmed.replace(/"([^"]+)"/g, (match, phrase) => {
    exactPhrases.push(phrase.toLowerCase());
    return '';
  });
  
  processedQuery = processedQuery.trim();
  
  // Split by | for OR groups, then by space for AND within groups
  const orGroups: string[][] = [];
  
  if (processedQuery) {
    const groups = processedQuery.split('|').map(g => g.trim()).filter(g => g);
    
    for (const group of groups) {
      const andTerms = group.split(/\s+/).filter(t => t);
      if (andTerms.length > 0) {
        orGroups.push(andTerms);
      }
    }
  }
  
  return {
    exactPhrases,
    orGroups,
    hasContent: exactPhrases.length > 0 || orGroups.length > 0
  };
}

/**
 * Match a search query against text content
 * 
 * @param text - The text to search in (will be lowercased)
 * @param query - The search query string
 * @returns true if the text matches the query
 */
export function matchesSearchQuery(text: string, query: string): boolean {
  const searchText = text.toLowerCase();
  const parsed = parseSearchQuery(query);
  
  // Check exact phrases first
  for (const phrase of parsed.exactPhrases) {
    if (!searchText.includes(phrase)) {
      return false;
    }
  }
  
  // If only exact phrases, return true if all matched
  if (parsed.orGroups.length === 0) {
    return parsed.exactPhrases.length > 0;
  }
  
  // Check OR groups - at least one group must match
  return parsed.orGroups.some(orGroup => {
    // Within each OR group, all AND terms must match
    return orGroup.every(term => {
      if (term.endsWith('*')) {
        // Wildcard prefix matching
        const prefix = term.slice(0, -1).toLowerCase();
        return searchText.includes(prefix);
      }
      return searchText.includes(term.toLowerCase());
    });
  });
}

/**
 * Match a search query against multiple text fields
 * 
 * @param fields - Object with text fields to search
 * @param query - The search query string
 * @returns true if any field matches the query
 */
export function matchesSearchQueryFields(
  fields: Record<string, string | undefined>,
  query: string
): boolean {
  // Combine all field values into a single searchable string
  const searchText = Object.values(fields)
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .map(v => v.toLowerCase())
    .join(' ');
  
  return matchesSearchQuery(searchText, query);
}

