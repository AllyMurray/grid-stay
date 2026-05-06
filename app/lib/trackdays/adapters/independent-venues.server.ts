import {
  defaultTextFetch,
  extractHtmlLabelValue,
  extractJsonLdEntries,
  type JsonLdObject,
  parseBritishDate,
  parseIsoDate,
  parseMonthDayWithYear,
  stripHtml,
} from '~/lib/circuit-sources/shared.server';
import type { FetchFunction, TrackDay, TrackDayAdapter, TrackDayFetchOptions } from '../types';

export const ANGLESEY_CIRCUIT_ID = '01HQ8VXMN0ANGLESEY';
export const CASTLE_COMBE_CIRCUIT_ID = '01HQ8VXMN0CASTLECOMBE';
export const CROFT_CIRCUIT_ID = '01HQ8VXMN0CROFT';
export const LYDDEN_HILL_CIRCUIT_ID = '01HQ8VXMN0LYDDENHILL';
export const MALLORY_PARK_CIRCUIT_ID = '01HQ8VXMN0MALLORYPARK';
export const THRUXTON_CIRCUIT_ID = '01HQ8VXMN0THRUXTON';

export const ANGLESEY_CIRCUIT_NAME = 'Anglesey';
export const CASTLE_COMBE_CIRCUIT_NAME = 'Castle Combe';
export const CROFT_CIRCUIT_NAME = 'Croft';
export const LYDDEN_HILL_CIRCUIT_NAME = 'Lydden Hill';
export const MALLORY_PARK_CIRCUIT_NAME = 'Mallory Park';
export const THRUXTON_CIRCUIT_NAME = 'Thruxton';

export const ANGLESEY_EVENTS_URL = 'https://www.angleseycircuit.co.uk/wp-json/tml/v1/events';
export const CASTLE_COMBE_TRACKDAY_URL = 'https://castlecombecircuit.co.uk/shop/car-track-day/';
export const CROFT_SITEMAP_URL = 'https://croftcircuit.co.uk/sitemap.xml';
export const LYDDEN_TRACKDAY_URL = 'https://lyddenhill.co.uk/trackdays/cars/';
export const MALLORY_EVENTS_URL = 'https://www.malloryparkcircuit.com/events/';
export const THRUXTON_TRACKDAYS_URL = 'https://shop.thruxtonracing.co.uk/trackdays';

interface AngleseyEventCategory {
  slug?: string;
}

interface AngleseyEventMeta {
  booking?: string;
  circuit?: string | null;
  enddate?: string;
  startdate?: string;
}

interface AngleseyEvent {
  category?: AngleseyEventCategory[];
  content?: string;
  guid?: number | string;
  meta?: AngleseyEventMeta;
  organiser?: string[];
  permalink?: string;
  title?: string;
}

function filterTrackDaysByDate(days: TrackDay[], options?: TrackDayFetchOptions): TrackDay[] {
  return days.filter((day) => {
    if (options?.fromDate && day.date < options.fromDate) {
      return false;
    }
    if (options?.toDate && day.date > options.toDate) {
      return false;
    }

    return true;
  });
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function hasType(entry: JsonLdObject, type: string): boolean {
  const entryType = entry['@type'];
  if (typeof entryType === 'string') {
    return entryType === type;
  }

  return Array.isArray(entryType) && entryType.includes(type);
}

function getOrganizerName(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return stripHtml(value);
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return getString((value as JsonLdObject).name);
}

function parseThruxtonSectionDates(html: string, label: 'Track Days' | 'Test Days'): string[] {
  const match = html.match(new RegExp(`${label} Available On:\\s*([^<]+)`, 'i'));
  const sectionText = stripHtml(match?.[1] ?? '');
  if (
    !sectionText ||
    /information coming soon/i.test(sectionText) ||
    /call now/i.test(sectionText)
  ) {
    return [];
  }

  return [
    ...new Set(
      sectionText
        .split(/[,/]|(?:\s{2,})/g)
        .map((part) => parseBritishDate(part))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

export function parseAngleseyTrackDays(json: string): TrackDay[] {
  const events = JSON.parse(json) as AngleseyEvent[];

  return events.flatMap((event) => {
    if (/sprint/i.test(event.title ?? '')) {
      return [];
    }

    const categorySlugs = (event.category ?? [])
      .map((category) => category.slug)
      .filter((slug): slug is string => Boolean(slug));
    if (!categorySlugs.includes('car-track-day')) {
      return [];
    }

    const date = parseIsoDate(event.meta?.startdate);
    if (!date) {
      return [];
    }

    return [
      {
        date,
        circuitName: ANGLESEY_CIRCUIT_NAME,
        circuitId: ANGLESEY_CIRCUIT_ID,
        layout: getString(event.meta?.circuit) ?? undefined,
        format: event.content ? extractHtmlLabelValue(event.content, 'Format') : undefined,
        organizer: event.organiser?.[0] ?? 'Anglesey Circuit',
        availability: 'unknown',
        bookingUrl: getString(event.meta?.booking) || event.permalink,
        source: 'anglesey-trackday',
        externalId: event.guid ? String(event.guid) : undefined,
      },
    ];
  });
}

export function parseCastleCombeTrackDays(html: string): TrackDay[] {
  const productGroup = extractJsonLdEntries(html).find(
    (entry) => hasType(entry, 'ProductGroup') && Array.isArray(entry.hasVariant),
  );
  if (!productGroup || !Array.isArray(productGroup.hasVariant)) {
    return [];
  }

  return productGroup.hasVariant.flatMap((variantValue) => {
    if (!variantValue || typeof variantValue !== 'object') {
      return [];
    }

    const variant = variantValue as JsonLdObject;
    const name = stripHtml(getString(variant.name) ?? '');
    if (!name || /additional driver/i.test(name)) {
      return [];
    }

    const date = parseBritishDate(name);
    if (!date) {
      return [];
    }

    const offers = variant.offers;
    let bookingUrl: string | undefined;
    if (offers && typeof offers === 'object') {
      bookingUrl = getString((offers as JsonLdObject).url);
    }

    return [
      {
        date,
        circuitName: CASTLE_COMBE_CIRCUIT_NAME,
        circuitId: CASTLE_COMBE_CIRCUIT_ID,
        format: 'Open Pit Lane',
        organizer: 'Castle Combe Circuit',
        duration: 'Full Day',
        availability: 'unknown',
        bookingUrl,
        source: 'castle-combe-trackday',
        externalId: bookingUrl ?? name,
      },
    ];
  });
}

export function parseLyddenTrackDays(html: string): TrackDay[] {
  const yearMatch = html.match(/Available dates\s*(?:&#8211;|–|-)\s*(\d{4})/i);
  const year = yearMatch?.[1];
  if (!year) {
    return [];
  }

  const availableDatesSection =
    html.match(/Available dates\s*(?:&#8211;|–|-)\s*\d{4}<\/h2>\s*<p>([\s\S]*?)<\/p>/i)?.[1] ?? '';

  return [...availableDatesSection.matchAll(/(\d{1,2}(?:st|nd|rd|th)\s+[A-Za-z]+)/gi)]
    .map((match) => parseMonthDayWithYear(match[1], year))
    .filter((date): date is string => Boolean(date))
    .map((date) => ({
      date,
      circuitName: LYDDEN_HILL_CIRCUIT_NAME,
      circuitId: LYDDEN_HILL_CIRCUIT_ID,
      format: 'Car Track Day',
      organizer: 'Lydden Hill',
      duration: 'Full Day',
      availability: 'unknown' as const,
      bookingUrl: 'https://lhrc.alphatiming.co.uk/register/events',
      source: 'lydden-trackday',
      externalId: `lydden-trackday:${date}`,
    }));
}

export function parseMalloryTrackDays(html: string): TrackDay[] {
  return extractJsonLdEntries(html).flatMap((entry) => {
    if (!hasType(entry, 'Event')) {
      return [];
    }

    const name = stripHtml(getString(entry.name) ?? '');
    if (!/^Javelin Trackdays$/i.test(name)) {
      return [];
    }

    const date = parseIsoDate(entry.startDate);
    if (!date) {
      return [];
    }

    return [
      {
        date,
        circuitName: MALLORY_PARK_CIRCUIT_NAME,
        circuitId: MALLORY_PARK_CIRCUIT_ID,
        format: 'Javelin Trackdays',
        organizer: 'Javelin Trackdays',
        availability: 'unknown',
        bookingUrl: getString(entry.url),
        source: 'mallory-trackday',
        externalId: getString(entry.url) ?? `mallory-trackday:${date}`,
      },
    ];
  });
}

export function extractCroftTrackDayUrls(sitemapXml: string): string[] {
  return [
    ...new Set(
      [
        ...sitemapXml.matchAll(
          /<loc>(https:\/\/croftcircuit\.co\.uk\/racing\/[^<]*track-day[^<]*)<\/loc>/g,
        ),
      ].map((match) => match[1]),
    ),
  ].toSorted();
}

export function parseCroftTrackDayPage(html: string, url: string): TrackDay | null {
  const event = extractJsonLdEntries(html).find((entry) => hasType(entry, 'SportsEvent'));
  if (!event) {
    return null;
  }

  const name = stripHtml(getString(event.name) ?? '');
  if (!/track day/i.test(name) || /motorcycle|bike/i.test(name)) {
    return null;
  }

  const date = parseIsoDate(event.startDate);
  if (!date) {
    return null;
  }

  return {
    date,
    circuitName: CROFT_CIRCUIT_NAME,
    circuitId: CROFT_CIRCUIT_ID,
    format: name,
    organizer: getOrganizerName(event.organizer) ?? 'Croft Circuit',
    availability: 'unknown',
    bookingUrl: getString(event.url) ?? url,
    source: 'croft-trackday',
    externalId: getString(event.url) ?? url,
  };
}

export function parseThruxtonTrackDays(html: string): TrackDay[] {
  return parseThruxtonSectionDates(html, 'Track Days').map((date) => ({
    date,
    circuitName: THRUXTON_CIRCUIT_NAME,
    circuitId: THRUXTON_CIRCUIT_ID,
    format: 'Track Day',
    organizer: 'Thruxton',
    availability: 'unknown',
    bookingUrl: THRUXTON_TRACKDAYS_URL,
    source: 'thruxton-trackday',
    externalId: `thruxton-trackday:${date}`,
  }));
}

async function loadCroftTrackDays(fetchFn: FetchFunction): Promise<TrackDay[]> {
  const sitemapXml = await fetchFn(CROFT_SITEMAP_URL);
  const pageUrls = extractCroftTrackDayUrls(sitemapXml);
  if (pageUrls.length === 0) {
    return [];
  }

  const pages = await Promise.all(pageUrls.map((url) => fetchFn(url)));
  return pages
    .map((html, index) => parseCroftTrackDayPage(html, pageUrls[index]))
    .filter((day): day is TrackDay => Boolean(day));
}

export function createAngleseyTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'anglesey-trackday',
    description: 'Anglesey Circuit car track day feed',
    circuitIds: [ANGLESEY_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(ANGLESEY_CIRCUIT_ID)) {
        return [];
      }

      const json = await fetchFn(ANGLESEY_EVENTS_URL);
      return filterTrackDaysByDate(parseAngleseyTrackDays(json), options);
    },
  };
}

export function createCastleCombeTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'castle-combe-trackday',
    description: 'Castle Combe Circuit car track day feed',
    circuitIds: [CASTLE_COMBE_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(CASTLE_COMBE_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(CASTLE_COMBE_TRACKDAY_URL);
      return filterTrackDaysByDate(parseCastleCombeTrackDays(html), options);
    },
  };
}

export function createCroftTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'croft-trackday',
    description: 'Croft Circuit car track day feed',
    circuitIds: [CROFT_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(CROFT_CIRCUIT_ID)) {
        return [];
      }

      const days = await loadCroftTrackDays(fetchFn);
      return filterTrackDaysByDate(days, options);
    },
  };
}

export function createLyddenTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'lydden-trackday',
    description: 'Lydden Hill car track day feed',
    circuitIds: [LYDDEN_HILL_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(LYDDEN_HILL_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(LYDDEN_TRACKDAY_URL);
      return filterTrackDaysByDate(parseLyddenTrackDays(html), options);
    },
  };
}

export function createMalloryTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'mallory-trackday',
    description: 'Mallory Park car track day feed',
    circuitIds: [MALLORY_PARK_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(MALLORY_PARK_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(MALLORY_EVENTS_URL);
      return filterTrackDaysByDate(parseMalloryTrackDays(html), options);
    },
  };
}

export function createThruxtonTrackDayAdapter(fetchFn: FetchFunction): TrackDayAdapter {
  return {
    name: 'thruxton-trackday',
    description: 'Thruxton track day feed',
    circuitIds: [THRUXTON_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(THRUXTON_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(THRUXTON_TRACKDAYS_URL);
      return filterTrackDaysByDate(parseThruxtonTrackDays(html), options);
    },
  };
}

export const angleseyTrackDayAdapter = createAngleseyTrackDayAdapter(defaultTextFetch);
export const castleCombeTrackDayAdapter = createCastleCombeTrackDayAdapter(defaultTextFetch);
export const croftTrackDayAdapter = createCroftTrackDayAdapter(defaultTextFetch);
export const lyddenTrackDayAdapter = createLyddenTrackDayAdapter(defaultTextFetch);
export const malloryTrackDayAdapter = createMalloryTrackDayAdapter(defaultTextFetch);
export const thruxtonTrackDayAdapter = createThruxtonTrackDayAdapter(defaultTextFetch);
