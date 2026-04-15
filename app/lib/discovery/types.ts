/**
 * Discovery module types for finding and importing racing series data.
 */

/**
 * A discovered racing series result from any source.
 */
export interface DiscoveryResult {
  /** Series name */
  name: string;
  /** Organiser/sanctioning body */
  organiser?: string;
  /** Official website URL */
  website?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country?: string;
  /** Category/discipline (e.g., "single seater", "GT", "club") */
  category?: string;
  /** Description of the series */
  description?: string;
  /** Source of the discovery (adapter name) */
  source: string;
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** External ID from source system */
  externalId?: string;
  /** Discovered seasons */
  seasons?: DiscoveredSeason[];
}

/**
 * A discovered season within a series.
 */
export interface DiscoveredSeason {
  /** Season year */
  year: number;
  /** Season name (e.g., "2024 Championship") */
  name?: string;
  /** Calendar of rounds */
  rounds?: DiscoveredRound[];
  /** External ID from source system */
  externalId?: string;
}

/**
 * A discovered round/event within a season.
 */
export interface DiscoveredRound {
  /** Round number */
  roundNumber: number;
  /** Event name */
  name: string;
  /** Circuit/venue name */
  circuit?: string;
  /** Start date (ISO format) */
  startDate?: string;
  /** End date (ISO format) */
  endDate?: string;
  /** External ID from source system */
  externalId?: string;
}

/**
 * Source adapter interface for discovery.
 * Each adapter fetches data from a specific source (API, website, etc.)
 */
export interface SourceAdapter {
  /** Unique adapter name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Priority for ranking results (higher = more trusted) */
  priority: number;

  /**
   * Search for series matching the query.
   * @param query - Search term (series name, organiser, etc.)
   * @returns Array of discovery results
   */
  search(query: string): Promise<DiscoveryResult[]>;

  /**
   * Check if this adapter can handle the given query.
   * Useful for targeted lookups (e.g., specific URLs).
   */
  canHandle(query: string): boolean;
}

/**
 * Discovery search options.
 */
export interface DiscoveryOptions {
  /** Country to filter by */
  country?: string;
  /** Category to filter by */
  category?: string;
  /** Maximum results to return */
  limit?: number;
  /** Whether to use cached results */
  useCache?: boolean;
}

/**
 * Aggregated discovery response.
 */
export interface DiscoveryResponse {
  /** Deduplicated and ranked results */
  results: DiscoveryResult[];
  /** Whether results came from cache */
  fromCache: boolean;
  /** Cache timestamp if cached */
  cachedAt?: string;
  /** Sources that were queried */
  sources: string[];
}
