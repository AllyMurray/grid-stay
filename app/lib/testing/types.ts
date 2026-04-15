/**
 * Testing day schedule types for fetching circuit testing availability.
 */

/**
 * HTTP fetch function signature for adapter dependency injection.
 */
export type FetchFunction = (
  url: string,
  init?: RequestInit,
) => Promise<string>;

/**
 * A testing day available at a circuit.
 */
export interface TestingDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Circuit name from the source */
  circuitName: string;
  /** Matched internal circuit ID */
  circuitId: string;
  /** Track layout/configuration (e.g. "Grand Prix", "National") */
  layout?: string;
  /** Session format (e.g. "Open Pit Lane", "Semi-Exclusive") */
  format?: string;
  /** Vehicle eligibility group (e.g. "Open Wheel", "Closed Wheel") */
  group?: string;
  /** Price in GBP pence */
  pricePennies?: number;
  /** Availability status */
  availability: 'available' | 'limited' | 'sold_out' | 'unknown';
  /** URL to book this test day */
  bookingUrl?: string;
  /** Adapter that produced this result */
  source: string;
  /** External ID from source system */
  externalId?: string;
}

/**
 * Circuit-centric adapter interface.
 * Each adapter declares which circuit IDs it covers and fetches schedules for them.
 */
export interface TestingAdapter {
  /** Unique adapter name */
  name: string;
  /** Human-readable description */
  description: string;
  /** All circuit IDs this adapter can serve */
  circuitIds: string[];
  /**
   * Fetch testing schedule for the given circuit IDs.
   * Accepts an array to allow batch fetching (e.g. MSV covers multiple circuits in one API call).
   */
  fetchSchedule(
    circuitIds: string[],
    options?: TestingFetchOptions,
  ): Promise<TestingDay[]>;
}

/**
 * Options for filtering testing schedule results.
 */
export interface TestingFetchOptions {
  /** Only return days on or after this date (ISO YYYY-MM-DD) */
  fromDate?: string;
  /** Only return days on or before this date (ISO YYYY-MM-DD) */
  toDate?: string;
}

/**
 * Aggregated testing schedule response.
 */
export interface TestingResponse {
  /** Flat list of testing days across all circuits */
  results: TestingDay[];
  /** Whether results came from cache */
  fromCache: boolean;
  /** When results were fetched */
  fetchedAt: string;
  /** Sources that contributed results */
  sources: string[];
}
