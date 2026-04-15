/**
 * MSV (MotorSport Vision) track day adapter.
 * Scrapes HTML calendar pages from MSV circuit websites.
 * Covers: Brands Hatch, Donington Park, Snetterton, Oulton Park, Cadwell Park, Bedford Autodrome
 */
import type { FetchFunction, TrackDay, TrackDayAdapter } from '../types';

/**
 * MSV circuit text name + layout → internal circuit ID mapping.
 */
export const MSV_TRACKDAY_CIRCUIT_MAP: Record<string, string> = {
  'Brands Hatch:Indy': '01HQ8VXMN0BRANDSINDY',
  'Brands Hatch:GP': '01HQ8VXMN0BRANDSGP',
  'Donington Park:National': '01HQ8VXMN0DONINGTONNAT',
  'Donington Park:GP': '01HQ8VXMN0DONINGTONGP',
  Snetterton: '01HQ8VXMN0SNETTERTON',
  'Oulton Park': '01HQ8VXMN0OULTONPARK',
  'Cadwell Park': '01HQ8VXMN0CADWELLPARK',
  'Bedford Autodrome': '01HQ8VXMN0BEDFORD',
};

/**
 * All circuit IDs that the MSV track day adapter covers.
 */
export const MSV_TRACKDAY_CIRCUIT_IDS = [
  ...new Set(Object.values(MSV_TRACKDAY_CIRCUIT_MAP)),
];

/**
 * URLs to scrape per circuit. Some circuits share a URL (e.g. Brands Hatch GP & Indy).
 */
export const MSV_TRACKDAY_URLS: Record<string, string> = {
  'brands-hatch': 'https://www.brandshatch.co.uk/calendar/trackdays/car',
  donington: 'https://www.donington-park.co.uk/calendar/trackdays/car',
  'oulton-park': 'https://www.oultonpark.co.uk/calendar/trackdays/car',
  cadwell: 'https://www.cadwellpark.co.uk/calendar/trackdays/car',
  snetterton: 'https://www.snetterton.co.uk/calendar/trackdays/car',
  bedford: 'https://www.bedfordautodrome.com/calendar/trackdays/car',
};

/**
 * Maps a requested circuit ID to the MSV page URL(s) that should be fetched.
 */
const CIRCUIT_ID_TO_URL_KEY: Record<string, string> = {
  '01HQ8VXMN0BRANDSINDY': 'brands-hatch',
  '01HQ8VXMN0BRANDSGP': 'brands-hatch',
  '01HQ8VXMN0DONINGTONNAT': 'donington',
  '01HQ8VXMN0DONINGTONGP': 'donington',
  '01HQ8VXMN0SNETTERTON': 'snetterton',
  '01HQ8VXMN0OULTONPARK': 'oulton-park',
  '01HQ8VXMN0CADWELLPARK': 'cadwell',
  '01HQ8VXMN0BEDFORD': 'bedford',
};

/**
 * A parsed track day event from an MSV calendar page.
 */
export interface MsvTrackDayEvent {
  date: string;
  circuitName: string;
  layout?: string;
  organizer?: string;
  duration?: string;
  eventType?: string;
  bookingUrl?: string;
}

/**
 * Resolves an MSV circuit text name + layout to an internal circuit ID.
 */
export function resolveCircuitId(
  circuitName: string,
  layout?: string,
): string | undefined {
  // Try specific name:layout first
  if (layout) {
    const specific = MSV_TRACKDAY_CIRCUIT_MAP[`${circuitName}:${layout}`];
    if (specific) return specific;
  }

  // Fall back to name-only mapping
  return MSV_TRACKDAY_CIRCUIT_MAP[circuitName];
}

/**
 * Strips HTML tags and trims whitespace.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Parses track day events from MSV calendar page HTML.
 *
 * MSV calendar pages use a list/card layout. Each event is typically in a
 * container with date, venue, layout, organizer, and a "More Info" link.
 *
 * We look for repeating patterns of:
 * - Date text (day month year)
 * - Venue/circuit name
 * - Layout (Indy/GP/National)
 * - Organizer name
 * - Duration (Full Day, Evening, etc.)
 * - Link to booking page
 */
export function parseMsvTrackDayCalendar(html: string): MsvTrackDayEvent[] {
  const events: MsvTrackDayEvent[] = [];

  // Preferred parser for current MSV markup:
  // <div class="calendar-item ..."> ...
  //   <span>Mon 23 Feb</span><span class="type">Full Day</span>
  //   <div class="... venue"><b>Donington Park</b><span>National</span></div>
  //   <div class="... event-name"><a href="...">MSV Car Trackdays</a><span>General Track Day</span></div>
  // </div>
  const itemPattern =
    /<div[^>]*class="[^"]*calendar-item[^"]*"[^>]*>[\s\S]*?<span>\s*((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{1,2}\s+[A-Za-z]{3})\s*<\/span>[\s\S]*?<span[^>]*class="[^"]*type[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>[\s\S]*?<div[^>]*class="[^"]*venue[^"]*"[^>]*>[\s\S]*?<b>\s*([^<]+?)\s*<\/b>[\s\S]*?<span>\s*([^<]+?)\s*<\/span>[\s\S]*?<div[^>]*class="[^"]*event-name[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>[\s\S]*?<span>\s*([^<]*?)\s*<\/span>/gi;

  for (const match of html.matchAll(itemPattern)) {
    const shortDate = match[1]?.trim();
    const duration = match[2]?.trim();
    const circuitName = match[3]?.trim();
    const layout = match[4]?.trim();
    const bookingUrl = normalizeBookingUrl(match[5]?.trim() ?? '');
    const organizer = match[6]?.trim();
    const eventSuffix = match[7]?.trim();
    const eventType = [organizer, eventSuffix].filter(Boolean).join(' - ');

    const date = parseShortDate(shortDate, bookingUrl);
    if (!date || !circuitName) continue;

    events.push({
      date,
      circuitName,
      layout: layout || undefined,
      organizer: organizer || undefined,
      duration: duration || undefined,
      eventType: eventType || undefined,
      bookingUrl,
    });
  }

  if (events.length > 0) {
    return events;
  }

  // Match calendar event containers - MSV uses various markup patterns
  // Look for date + venue patterns in table rows or list items
  const eventPattern =
    /<(?:tr|li|div|article)[^>]*class="[^"]*(?:calendar|event|listing)[^"]*"[^>]*>([\s\S]*?)<\/(?:tr|li|div|article)>/gi;

  for (const match of html.matchAll(eventPattern)) {
    const content = match[1];
    const event = parseEventContent(content);
    if (event) {
      events.push(event);
    }
  }

  // Fallback: try table rows with date patterns
  if (events.length === 0) {
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    for (const match of html.matchAll(rowPattern)) {
      const content = match[1];
      const event = parseEventContent(content);
      if (event) {
        events.push(event);
      }
    }
  }

  return events;
}

function parseShortDate(
  shortDate: string,
  bookingUrl?: string,
): string | undefined {
  const match = shortDate.match(
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]{3})$/i,
  );
  if (!match) return undefined;

  const day = match[1].padStart(2, '0');
  const monthKey = match[2].toLowerCase();
  const monthMap: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const month = monthMap[monthKey];
  if (!month) return undefined;

  const yearFromUrl = bookingUrl?.match(/\/(\d{4})\/\d{1,2}\/\d{1,2}/)?.[1];
  const year = yearFromUrl ?? String(new Date().getFullYear());

  return `${year}-${month}-${day}`;
}

/**
 * Tries to extract event data from an HTML content block.
 */
function parseEventContent(content: string): MsvTrackDayEvent | null {
  // Try to extract a date - look for datetime attribute or date-like text
  const dateTimeMatch = content.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
  const dateAttrMatch = content.match(/data-date="(\d{4}-\d{2}-\d{2})"/i);

  let date: string | undefined;

  if (dateTimeMatch) {
    date = dateTimeMatch[1].slice(0, 10);
  } else if (dateAttrMatch) {
    date = dateAttrMatch[1];
  } else {
    // Try parsing date from text like "15 March 2026" or "15/03/2026"
    const dateTextMatch = content.match(
      /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    );
    if (dateTextMatch) {
      const day = dateTextMatch[1].padStart(2, '0');
      const monthNames: Record<string, string> = {
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
      };
      const month = monthNames[dateTextMatch[2].toLowerCase()];
      const year = dateTextMatch[3];
      date = `${year}-${month}-${day}`;
    }
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  // Extract venue/circuit name
  const venueMatch =
    content.match(/<[^>]*class="[^"]*venue[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i) ??
    content.match(/<[^>]*class="[^"]*circuit[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
  const circuitName = venueMatch ? stripHtml(venueMatch[1]) : undefined;

  // Extract layout (Indy, GP, National)
  const layoutMatch = content.match(
    /<[^>]*class="[^"]*(?:layout|configuration)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i,
  );
  const layout = layoutMatch ? stripHtml(layoutMatch[1]) : undefined;

  // Extract organizer
  const organizerMatch = content.match(
    /<[^>]*class="[^"]*(?:organiser|organizer|provider)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i,
  );
  const organizer = organizerMatch ? stripHtml(organizerMatch[1]) : undefined;

  // Extract duration
  const durationMatch = content.match(
    /\b(Full Day|Half Day|Evening|Morning)\b/i,
  );
  const duration = durationMatch ? durationMatch[1] : undefined;

  // Extract event type/name
  const titleMatch =
    content.match(
      /<[^>]*class="[^"]*(?:title|name|event-name)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i,
    ) ?? content.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
  const eventType = titleMatch ? stripHtml(titleMatch[1]) : undefined;

  // Extract booking URL
  const linkMatch = content.match(
    /<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?(?:more info|book|details)[\s\S]*?<\/a>/i,
  );
  const bookingUrl = linkMatch ? linkMatch[1] : undefined;

  return {
    date,
    circuitName: circuitName ?? '',
    layout,
    organizer,
    duration,
    eventType,
    bookingUrl: bookingUrl ? normalizeBookingUrl(bookingUrl) : undefined,
  };
}

/**
 * Normalizes a potentially relative booking URL.
 */
function normalizeBookingUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `https://car.msvtrackdays.com${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Default fetch implementation for MSV pages.
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
 * Creates an MSV track day adapter with injectable fetch.
 */
export function createMsvTrackDayAdapter(
  fetchFn: FetchFunction,
): TrackDayAdapter {
  return {
    name: 'msv-trackday',
    description:
      'MSV circuits track days (Brands Hatch, Donington, Snetterton, Oulton Park, Cadwell Park, Bedford)',
    circuitIds: MSV_TRACKDAY_CIRCUIT_IDS,

    async fetchSchedule(circuitIds, options) {
      const relevantIds = circuitIds.filter((id) =>
        MSV_TRACKDAY_CIRCUIT_IDS.includes(id),
      );
      if (relevantIds.length === 0) return [];

      // Determine unique URLs to fetch (dedup for shared pages like Brands Hatch)
      const urlKeys = new Set<string>();
      for (const id of relevantIds) {
        const key = CIRCUIT_ID_TO_URL_KEY[id];
        if (key) urlKeys.add(key);
      }

      // Fetch all pages in parallel
      const fetchResults = await Promise.allSettled(
        [...urlKeys].map(async (key) => {
          const url = MSV_TRACKDAY_URLS[key];
          const html = await fetchFn(url);
          return { key, html };
        }),
      );

      const allDays: TrackDay[] = [];

      for (const result of fetchResults) {
        if (result.status !== 'fulfilled') continue;

        const { html } = result.value;
        const events = parseMsvTrackDayCalendar(html);

        for (const event of events) {
          const circuitId = resolveCircuitId(event.circuitName, event.layout);
          if (!circuitId) continue;

          // Only include if this circuit was requested
          if (!relevantIds.includes(circuitId)) continue;

          allDays.push({
            date: event.date,
            circuitName: event.circuitName,
            circuitId,
            layout: event.layout,
            format: event.eventType,
            organizer: event.organizer,
            duration: event.duration,
            availability: 'unknown',
            bookingUrl: event.bookingUrl,
            source: 'msv-trackday',
          });
        }
      }

      // Apply date filters
      let days = allDays;
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
 * Pre-configured MSV track day adapter.
 */
export const msvTrackDayAdapter = createMsvTrackDayAdapter(defaultFetch);
