/**
 * Caterham adapter for discovering Caterham racing series.
 * Extracts calendar data from https://caterhamcars.com/en/motorsport/championship-calendar
 */
import {
  normalizeCircuitLabel,
  normalizeCircuitName,
} from '~/lib/circuit-sources/shared.server';
import type {
  DiscoveredRound,
  DiscoveredSeason,
  DiscoveryResult,
  SourceAdapter,
} from '../types';

/**
 * HTTP fetch function (can be overridden for testing).
 */
export type FetchFunction = (url: string) => Promise<string>;

/**
 * Calendar URL for Caterham Motorsport.
 */
export const CATERHAM_CALENDAR_URL =
  'https://caterhamcars.com/en/motorsport/championship-calendar';

/**
 * Known Caterham series with their identifiers.
 * IDs match the championship abbreviations used on the calendar page.
 */
export const CATERHAM_SERIES = [
  {
    id: 'ACADEMY',
    name: 'Caterham Academy',
    category: 'club',
    description: 'Entry-level racing championship for new drivers',
  },
  {
    id: 'ROADSPORT',
    name: 'Caterham Roadsport',
    category: 'club',
    description: 'Racing for road-legal Caterham Sevens',
  },
  {
    id: '270R',
    name: 'Caterham 270R',
    category: 'club',
    description: 'Mid-level racing with 270bhp/tonne cars',
  },
  {
    id: '310R',
    name: 'Caterham 310R',
    category: 'club',
    description: 'High-performance racing championship',
  },
  {
    id: 'CSCUK',
    name: 'Caterham Sports Car Championship UK',
    category: 'club',
    description: 'UK Sports Car Championship for Caterhams',
  },
] as const;

/**
 * Parsed calendar event from the Caterham website.
 */
export interface CalendarEvent {
  date: string;
  endDate?: string;
  circuit: string;
  championships: string[];
}

/**
 * Parses events from Caterham calendar HTML.
 * The calendar uses a DataTable with data-order attributes for sorting.
 * Structure: <tr><td data-order="date">...<td data-order="circuit">...<td data-order="type">...<td data-order="championships">
 */
export function parseCalendarFromHtml(html: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Extract all data-order values from table rows
  // The calendar has 4 columns: date, circuit, event type, championships
  // We use data-order attributes which contain clean values for sorting
  const rowPattern =
    /<tr[^>]*class="[^"]*fs-table-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1];

    // Extract data-order values from each cell
    const dataOrderPattern = /data-order="([^"]*)"/g;
    const dataOrders: string[] = [];
    for (const dataMatch of rowHtml.matchAll(dataOrderPattern)) {
      dataOrders.push(dataMatch[1]);
    }

    // Need at least 4 columns: date, circuit, type, championships
    if (dataOrders.length < 4) {
      continue;
    }

    const dateStr = dataOrders[0].trim();
    const circuit = dataOrders[1].trim();
    // dataOrders[2] is event type (SPECIAL EVENT, SPRINT, etc.) - skip
    const championshipsStr = dataOrders[3].trim();

    // Skip header rows or empty data
    if (
      dateStr.toLowerCase().includes('date') ||
      circuit.toLowerCase().includes('circuit') ||
      !dateStr ||
      !circuit
    ) {
      continue;
    }

    // Parse championships (comma separated)
    const championships = championshipsStr
      .split(/,\s*/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0 && CATERHAM_SERIES.some((s) => s.id === c));

    // Skip rows with no valid championships
    if (championships.length === 0) {
      continue;
    }

    const parsed = parseDateRange(dateStr);
    if (parsed) {
      events.push({
        date: parsed.start,
        endDate: parsed.end,
        circuit,
        championships,
      });
    }
  }

  return events;
}

/**
 * Filters calendar events for a specific series and returns rounds.
 */
export function getSeriesRounds(
  events: CalendarEvent[],
  seriesId: string,
): DiscoveredRound[] {
  const seriesEvents = events.filter((e) =>
    e.championships.includes(seriesId.toUpperCase()),
  );

  return seriesEvents.map((event, index) => ({
    roundNumber: index + 1,
    name: `Round ${index + 1} - ${normalizeCircuitLabel(event.circuit)}`,
    circuit: normalizeCircuitName(event.circuit),
    startDate: event.date,
    endDate: event.endDate,
  }));
}

/**
 * Month name to number mapping.
 */
const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Parses a date range string like "11-12 April" or "29-31 May" into ISO dates.
 * Returns start and optional end date.
 */
export function parseDateRange(
  dateStr: string,
  defaultYear?: number,
): { start: string; end?: string } | undefined {
  const year = defaultYear || new Date().getFullYear();

  // Pattern: "11-12 April" or "29-31 May"
  const rangePattern = /(\d{1,2})-(\d{1,2})\s+(\w+)/i;
  const rangeMatch = dateStr.match(rangePattern);
  if (rangeMatch) {
    const [, startDay, endDay, monthName] = rangeMatch;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      return {
        start: `${year}-${month}-${startDay.padStart(2, '0')}`,
        end: `${year}-${month}-${endDay.padStart(2, '0')}`,
      };
    }
  }

  // Pattern: "09 May" (single day)
  const singlePattern = /(\d{1,2})\s+(\w+)/i;
  const singleMatch = dateStr.match(singlePattern);
  if (singleMatch) {
    const [, day, monthName] = singleMatch;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      return {
        start: `${year}-${month}-${day.padStart(2, '0')}`,
      };
    }
  }

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const fullDatePattern = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/;
  const fullMatch = dateStr.match(fullDatePattern);
  if (fullMatch) {
    const [, day, month, matchYear] = fullMatch;
    return {
      start: `${matchYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    };
  }

  return undefined;
}

/**
 * Checks if query matches Caterham-related terms.
 */
function matchesCaterham(query: string): boolean {
  const queryLower = query.toLowerCase();
  const caterhamTerms = [
    'caterham',
    'academy',
    'roadsport',
    '270r',
    '310r',
    'cscuk',
    'seven',
  ];
  return caterhamTerms.some((term) => queryLower.includes(term));
}

/**
 * Creates a Caterham adapter.
 * @param fetchFn - Function to fetch HTML (for testability)
 */
export function createCaterhamAdapter(fetchFn: FetchFunction): SourceAdapter {
  return {
    name: 'caterham',
    description: 'Caterham Motorsport racing series',
    priority: 9, // High priority - specific source for Caterham

    canHandle(query: string): boolean {
      return matchesCaterham(query);
    },

    async search(query: string): Promise<DiscoveryResult[]> {
      if (!matchesCaterham(query)) {
        return [];
      }

      const queryLower = query.toLowerCase();
      const results: DiscoveryResult[] = [];
      const currentYear = new Date().getFullYear();

      try {
        // Fetch the shared calendar page once
        let calendarEvents: CalendarEvent[] = [];
        try {
          const html = await fetchFn(CATERHAM_CALENDAR_URL);
          calendarEvents = parseCalendarFromHtml(html);
        } catch {
          // Calendar fetch failed, continue without rounds
          console.warn('Failed to fetch Caterham calendar');
        }

        // Find matching series
        const matchingSeries = CATERHAM_SERIES.filter(
          (series) =>
            series.name.toLowerCase().includes(queryLower) ||
            series.id.toLowerCase().includes(queryLower) ||
            queryLower.includes('caterham'),
        );

        for (const series of matchingSeries) {
          // Get rounds for this specific series from the shared calendar
          const rounds = getSeriesRounds(calendarEvents, series.id);
          let seasons: DiscoveredSeason[] | undefined;

          if (rounds.length > 0) {
            seasons = [
              {
                year: currentYear,
                name: `${series.name} ${currentYear}`,
                rounds,
              },
            ];
          }

          results.push({
            name: series.name,
            organiser: 'Caterham Motorsport',
            website: 'https://caterhamcars.com/en/motorsport',
            country: 'GB',
            category: series.category,
            description: series.description,
            source: 'caterham',
            confidence: rounds.length > 0 ? 0.95 : 0.8, // Lower confidence without calendar
            externalId: `caterham-${series.id}`,
            seasons,
          });
        }

        return results;
      } catch (error) {
        console.warn('Caterham adapter error:', error);
        return [];
      }
    },
  };
}

/**
 * Default fetch implementation.
 */
export async function defaultFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; ApexBook/1.0; +https://apexbook.racing)',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Pre-configured Caterham adapter using default implementations.
 */
export const caterhamAdapter = createCaterhamAdapter(defaultFetch);
