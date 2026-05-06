/**
 * MSV (MotorSport Vision) testing day adapter.
 * Fetches from JSON API at ebes-cms-api-v1.azurewebsites.net
 * Covers: Brands Hatch, Donington Park, Snetterton, Oulton Park, Cadwell Park, Bedford Autodrome
 */
import type { FetchFunction, TestingAdapter, TestingDay } from '../types';

export const MSV_API_URL = 'https://ebes-cms-api-v1.azurewebsites.net/api/TrackEntry/Events';

export const MSV_BOOKING_BASE = 'https://testing-v4.msv.com';

/**
 * MSV venue ID + layout → internal circuit ID mapping.
 */
export const MSV_CIRCUIT_MAP: Record<string, string> = {
  'BH:Indy': '01HQ8VXMN0BRANDSINDY',
  'BH:GP': '01HQ8VXMN0BRANDSGP',
  'DP:National': '01HQ8VXMN0DONINGTONNAT',
  'DP:GP': '01HQ8VXMN0DONINGTONGP',
  SN: '01HQ8VXMN0SNETTERTON',
  OP: '01HQ8VXMN0OULTONPARK',
  CP: '01HQ8VXMN0CADWELLPARK',
  BA: '01HQ8VXMN0BEDFORD',
};

/**
 * All circuit IDs that the MSV adapter covers.
 */
export const MSV_CIRCUIT_IDS = [...new Set(Object.values(MSV_CIRCUIT_MAP))];

/**
 * Raw MSV API event shape.
 */
export interface MsvApiEvent {
  id: string;
  date: string;
  name: string;
  venue: { id: string; fullName: string };
  circuitLayout: string | null;
  type: number;
  moreInfoUrl: string;
  minUnitPriceIncVat: number | null;
  currencyCode: string;
  venueCircuitLayout: string | null;
  availableSpaces?: number;
}

/**
 * Resolves an MSV venue ID + layout to an internal circuit ID.
 */
export function resolveCircuitId(venueId: string, layout: string | null): string | undefined {
  // Try specific venue:layout first
  if (layout) {
    const specific = MSV_CIRCUIT_MAP[`${venueId}:${layout}`];
    if (specific) return specific;
  }

  // Fall back to venue-only mapping
  return MSV_CIRCUIT_MAP[venueId];
}

/**
 * Parses MSV API JSON response into TestingDay entries.
 */
export function parseMsvEvents(events: MsvApiEvent[]): TestingDay[] {
  const days: TestingDay[] = [];

  for (const event of events) {
    const circuitId = resolveCircuitId(event.venue.id, event.circuitLayout);
    if (!circuitId) continue;

    const date = event.date.slice(0, 10); // YYYY-MM-DD from ISO datetime
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const pricePennies =
      event.minUnitPriceIncVat != null ? Math.round(event.minUnitPriceIncVat * 100) : undefined;

    let availability: TestingDay['availability'] = 'unknown';
    if (event.availableSpaces !== undefined) {
      if (event.availableSpaces === 0) {
        availability = 'sold_out';
      } else if (event.availableSpaces <= 5) {
        availability = 'limited';
      } else {
        availability = 'available';
      }
    } else {
      availability = 'available';
    }

    days.push({
      date,
      circuitName: event.venue.fullName,
      circuitId,
      layout: event.venueCircuitLayout ?? event.circuitLayout ?? undefined,
      format: event.name,
      pricePennies,
      availability,
      bookingUrl: event.moreInfoUrl ? `${MSV_BOOKING_BASE}${event.moreInfoUrl}` : undefined,
      source: 'msv',
      externalId: event.id,
    });
  }

  return days;
}

/**
 * Default fetch for MSV API.
 */
async function defaultFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ApexBook/1.0; +https://apexbook.racing)',
      Accept: 'application/json',
      Origin: 'https://testing-v4.msv.com',
      'session-id': crypto.randomUUID(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Creates an MSV adapter with injectable fetch.
 */
export function createMsvAdapter(fetchFn: FetchFunction): TestingAdapter {
  return {
    name: 'msv',
    description:
      'MSV circuits testing days (Brands Hatch, Donington, Snetterton, Oulton Park, Cadwell Park, Bedford)',
    circuitIds: MSV_CIRCUIT_IDS,

    async fetchSchedule(circuitIds, options) {
      // Check if any requested circuits are MSV circuits
      const relevantIds = circuitIds.filter((id) => MSV_CIRCUIT_IDS.includes(id));
      if (relevantIds.length === 0) return [];

      // Single API call returns all venues
      const json = await fetchFn(MSV_API_URL);
      const events: MsvApiEvent[] = JSON.parse(json);

      let days = parseMsvEvents(events);

      // Filter to requested circuits
      days = days.filter((d) => relevantIds.includes(d.circuitId));

      if (options?.fromDate) {
        days = days.filter((d) => d.date >= options.fromDate!);
      }
      if (options?.toDate) {
        days = days.filter((d) => d.date <= options.toDate!);
      }

      return days;
    },
  };
}

/**
 * Pre-configured MSV adapter.
 */
export const msvAdapter = createMsvAdapter(defaultFetch);
