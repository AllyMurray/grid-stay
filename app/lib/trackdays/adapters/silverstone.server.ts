/**
 * Silverstone track day adapter.
 * Scrapes https://www.silverstone.co.uk/track-and-testing/car-track-days
 */
import type { FetchFunction, TrackDay, TrackDayAdapter } from '../types';

const SILVERSTONE_CIRCUIT_ID = '01HQ8VXMN0SILVERSTONE';

export const SILVERSTONE_TRACKDAY_URL =
  'https://www.silverstone.co.uk/track-and-testing/car-track-days';

/**
 * Parses track day schedule from Silverstone HTML.
 *
 * Same Drupal Views table structure as testing page.
 */
export function parseSilverstoneTrackDaySchedule(html: string): TrackDay[] {
  const days: TrackDay[] = [];

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[0];
    const rowContent = rowMatch[1];

    const timeMatch = rowContent.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
    if (!timeMatch) continue;

    const datetime = timeMatch[1];
    const date = datetime.slice(0, 10);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const layout = extractFieldText(
      rowContent,
      'views-field-field-track-day-circuit',
    );

    const format = extractFieldText(
      rowContent,
      'views-field-field-format-masterclass',
    );

    const priceText = extractFieldText(
      rowContent,
      'views-field-field-track-day-current-price',
    );
    const priceMatch = priceText.match(/£(\d+(?:\.\d{2})?)/);
    const pricePennies = priceMatch
      ? Math.round(Number.parseFloat(priceMatch[1]) * 100)
      : undefined;

    const isSoldOut = /sold-out--status/i.test(rowHtml);
    const hasBookButton = /class="[^"]*btn[^"]*"[^>]*>.*?Book/i.test(
      rowContent,
    );
    let availability: TrackDay['availability'] = 'unknown';
    if (isSoldOut) {
      availability = 'sold_out';
    } else if (hasBookButton) {
      availability = 'available';
    }

    const bookingMatch = rowContent.match(
      /<a[^>]*class="[^"]*btn-primary[^"]*"[^>]*href="([^"]*)"[^>]*>/i,
    );
    const bookingUrl = bookingMatch
      ? normalizeBookingUrl(bookingMatch[1])
      : undefined;

    days.push({
      date,
      circuitName: 'Silverstone',
      circuitId: SILVERSTONE_CIRCUIT_ID,
      layout: layout || undefined,
      format: format || undefined,
      availability,
      bookingUrl,
      pricePennies,
      source: 'silverstone-trackday',
    });
  }

  return days;
}

/**
 * Extracts text content from a table cell with the given class.
 */
export function extractFieldText(html: string, className: string): string {
  const pattern = new RegExp(
    `<td[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)<\\/td>`,
    'i',
  );
  const match = html.match(pattern);
  if (!match) return '';

  const cleaned = match[1]
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  return cleaned.replace(/<[^>]*>/g, '').trim();
}

/**
 * Normalizes booking URL to absolute.
 */
function normalizeBookingUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `https://www.silverstone.co.uk${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Default fetch implementation for Silverstone.
 */
async function defaultFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Creates a Silverstone track day adapter with injectable fetch.
 */
export function createSilverstoneTrackDayAdapter(
  fetchFn: FetchFunction,
): TrackDayAdapter {
  return {
    name: 'silverstone-trackday',
    description: 'Silverstone Circuit track days',
    circuitIds: [SILVERSTONE_CIRCUIT_ID],

    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(SILVERSTONE_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(SILVERSTONE_TRACKDAY_URL);
      let days = parseSilverstoneTrackDaySchedule(html);

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
 * Pre-configured Silverstone track day adapter.
 */
export const silverstoneTrackDayAdapter =
  createSilverstoneTrackDayAdapter(defaultFetch);
