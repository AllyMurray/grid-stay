/**
 * Silverstone testing day adapter.
 * Scrapes https://www.silverstone.co.uk/track-and-testing/testing
 */
import type { FetchFunction, TestingAdapter, TestingDay } from '../types';

const SILVERSTONE_CIRCUIT_ID = '01HQ8VXMN0SILVERSTONE';

export const SILVERSTONE_URL =
  'https://www.silverstone.co.uk/track-and-testing/testing';

/**
 * Parses testing schedule from Silverstone HTML.
 *
 * HTML structure: Drupal Views `<table class="cols-7">` inside `<div class="table-wrapper--track">`.
 * Each `<tr>` contains:
 * - `<time datetime="...">` for the date
 * - `td.views-field-field-track-day-circuit` for layout
 * - `td.views-field-field-format-masterclass` for format
 * - `td.views-field-field-g-set-group` for vehicle group
 * - `tr.sold-out--status` class indicates sold out
 * - `a.btn-primary` with href for booking URL
 */
export function parseSilverstoneSchedule(html: string): TestingDay[] {
  const days: TestingDay[] = [];

  // Match each table row
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[0];
    const rowContent = rowMatch[1];

    // Extract date from <time datetime="...">
    const timeMatch = rowContent.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
    if (!timeMatch) continue;

    const datetime = timeMatch[1];
    const date = datetime.slice(0, 10); // YYYY-MM-DD from ISO datetime

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    // Extract layout from td.views-field-field-track-day-circuit
    const layout = extractFieldText(
      rowContent,
      'views-field-field-track-day-circuit',
    );

    // Extract format from td.views-field-field-format-masterclass
    const format = extractFieldText(
      rowContent,
      'views-field-field-format-masterclass',
    );

    // Extract group from td.views-field-field-g-set-group
    const group = extractFieldText(rowContent, 'views-field-field-g-set-group');

    // Extract price from td.views-field-field-track-day-current-price
    const priceText = extractFieldText(
      rowContent,
      'views-field-field-track-day-current-price',
    );
    const priceMatch = priceText.match(/£(\d+(?:\.\d{2})?)/);
    const pricePennies = priceMatch
      ? Math.round(Number.parseFloat(priceMatch[1]) * 100)
      : undefined;

    // Determine availability
    const isSoldOut = /sold-out--status/i.test(rowHtml);
    const hasBookButton = /class="[^"]*btn[^"]*"[^>]*>.*?Book/i.test(
      rowContent,
    );
    let availability: TestingDay['availability'] = 'unknown';
    if (isSoldOut) {
      availability = 'sold_out';
    } else if (hasBookButton) {
      availability = 'available';
    }

    // Extract booking URL from a.btn-primary
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
      group: group || undefined,
      availability,
      bookingUrl,
      pricePennies,
      source: 'silverstone',
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

  // Strip <style> and <script> blocks (e.g. inline SVG styles) before stripping tags
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
 * Creates a Silverstone adapter with injectable fetch.
 */
export function createSilverstoneAdapter(
  fetchFn: FetchFunction,
): TestingAdapter {
  return {
    name: 'silverstone',
    description: 'Silverstone Circuit testing days',
    circuitIds: [SILVERSTONE_CIRCUIT_ID],

    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(SILVERSTONE_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(SILVERSTONE_URL);
      let days = parseSilverstoneSchedule(html);

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
 * Pre-configured Silverstone adapter.
 */
export const silverstoneAdapter = createSilverstoneAdapter(defaultFetch);
