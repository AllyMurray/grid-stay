/**
 * Track day schedule types for fetching circuit track day availability.
 */

import type { FetchFunction } from '~/lib/testing/types';

export type { FetchFunction };

/**
 * A track day available at a circuit.
 */
export interface TrackDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Circuit name from the source */
  circuitName: string;
  /** Matched internal circuit ID */
  circuitId: string;
  /** Track layout/configuration (e.g. "Grand Prix", "National") */
  layout?: string;
  /** Session format (e.g. "Open Pit Lane", "Evening Session") */
  format?: string;
  /** Organizer name (e.g. "Javelin Trackdays") */
  organizer?: string;
  /** Duration (e.g. "Full Day", "Evening", "Half Day") */
  duration?: string;
  /** Price in GBP pence */
  pricePennies?: number;
  /** Availability status */
  availability: 'available' | 'limited' | 'sold_out' | 'unknown';
  /** URL to book this track day */
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
export interface TrackDayAdapter {
  /** Unique adapter name */
  name: string;
  /** Human-readable description */
  description: string;
  /** All circuit IDs this adapter can serve */
  circuitIds: string[];
  /**
   * Fetch track day schedule for the given circuit IDs.
   * Accepts an array to allow batch fetching (e.g. MSV covers multiple circuits in one page).
   */
  fetchSchedule(
    circuitIds: string[],
    options?: TrackDayFetchOptions,
  ): Promise<TrackDay[]>;
}

/**
 * Options for filtering track day schedule results.
 */
export interface TrackDayFetchOptions {
  /** Only return days on or after this date (ISO YYYY-MM-DD) */
  fromDate?: string;
  /** Only return days on or before this date (ISO YYYY-MM-DD) */
  toDate?: string;
}

/**
 * Aggregated track day schedule response.
 */
export interface TrackDayResponse {
  /** Flat list of track days across all circuits */
  results: TrackDay[];
  /** Whether results came from cache */
  fromCache: boolean;
  /** When results were fetched */
  fetchedAt: string;
  /** Sources that contributed results */
  sources: string[];
}
