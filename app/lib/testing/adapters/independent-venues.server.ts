import {
  defaultTextFetch,
  extractJsonLdEntries,
  type JsonLdObject,
  parseBritishDate,
  parseIsoDate,
  stripHtml,
} from '~/lib/circuit-sources/shared.server';
import {
  ANGLESEY_CIRCUIT_ID,
  ANGLESEY_CIRCUIT_NAME,
  ANGLESEY_EVENTS_URL,
  CROFT_CIRCUIT_ID,
  CROFT_CIRCUIT_NAME,
  CROFT_SITEMAP_URL,
  MALLORY_EVENTS_URL,
  MALLORY_PARK_CIRCUIT_ID,
  MALLORY_PARK_CIRCUIT_NAME,
  THRUXTON_CIRCUIT_ID,
  THRUXTON_CIRCUIT_NAME,
  THRUXTON_TRACKDAYS_URL,
} from '~/lib/trackdays/adapters/independent-venues.server';
import type {
  FetchFunction,
  TestingAdapter,
  TestingDay,
  TestingFetchOptions,
} from '../types';

interface AngleseyEventCategory {
  slug?: string;
}

interface AngleseyEventMeta {
  booking?: string;
  circuit?: string | null;
  startdate?: string;
}

interface AngleseyEvent {
  category?: AngleseyEventCategory[];
  guid?: number | string;
  meta?: AngleseyEventMeta;
  permalink?: string;
  testday?: boolean;
  title?: string;
}

function filterTestingDaysByDate(
  days: TestingDay[],
  options?: TestingFetchOptions,
): TestingDay[] {
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

function parseThruxtonTestingDates(html: string): string[] {
  const match = html.match(/Test Days Available On:\s*([^<]+)/i);
  const sectionText = stripHtml(match?.[1] ?? '');
  if (!sectionText || /information coming soon/i.test(sectionText)) {
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

function extractCroftTestingGroup(description: string): string | undefined {
  const normalized = stripHtml(description);
  const match = normalized.match(/for\s+(.+?)(?:\.|$)/i);
  return match?.[1]?.trim();
}

function extractMalloryTestingGroup(description: string): string | undefined {
  const normalized = stripHtml(description);
  const match = normalized.match(
    /Car Test Day\s*-\s*([^-.]+?(?:\s*&\s*[^-.]+?)?)(?:\s*-\s*\d|\.|$)/i,
  );
  return match?.[1]?.trim();
}

export function parseAngleseyTestingDays(json: string): TestingDay[] {
  const events = JSON.parse(json) as AngleseyEvent[];

  return events.flatMap((event) => {
    const categorySlugs = (event.category ?? [])
      .map((category) => category.slug)
      .filter((slug): slug is string => Boolean(slug));
    if (!event.testday && !categorySlugs.includes('general-testing')) {
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
        format: event.title ?? 'General Testing',
        availability: 'unknown',
        bookingUrl: getString(event.meta?.booking) || event.permalink,
        source: 'anglesey-testing',
        externalId: event.guid ? String(event.guid) : undefined,
      },
    ];
  });
}

export function parseMalloryTestingDays(html: string): TestingDay[] {
  return extractJsonLdEntries(html).flatMap((entry) => {
    if (!hasType(entry, 'Event')) {
      return [];
    }

    const name = stripHtml(getString(entry.name) ?? '');
    const description = stripHtml(getString(entry.description) ?? '');
    if (
      !/test day/i.test(name) ||
      (!/cars/i.test(name) && !/car test day/i.test(description))
    ) {
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
        format: name,
        group: extractMalloryTestingGroup(description),
        availability: 'unknown',
        bookingUrl: getString(entry.url),
        source: 'mallory-testing',
        externalId: getString(entry.url) ?? `mallory-testing:${date}`,
      },
    ];
  });
}

export function extractCroftTestingUrls(sitemapXml: string): string[] {
  return [
    ...new Set(
      [
        ...sitemapXml.matchAll(
          /<loc>(https:\/\/croftcircuit\.co\.uk\/racing\/[^<]*(?:test-day|testday)[^<]*)<\/loc>/g,
        ),
      ].map((match) => match[1]),
    ),
  ].sort();
}

export function parseCroftTestingPage(
  html: string,
  url: string,
): TestingDay | null {
  const event = extractJsonLdEntries(html).find((entry) =>
    hasType(entry, 'SportsEvent'),
  );
  if (!event) {
    return null;
  }

  const name = stripHtml(getString(event.name) ?? '');
  if (!/test day/i.test(name) || /motorcycle|bike/i.test(name)) {
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
    group: extractCroftTestingGroup(getString(event.description) ?? ''),
    availability: 'unknown',
    bookingUrl: getString(event.url) ?? url,
    source: 'croft-testing',
    externalId: getString(event.url) ?? url,
  };
}

export function parseThruxtonTestingDays(html: string): TestingDay[] {
  return parseThruxtonTestingDates(html).map((date) => ({
    date,
    circuitName: THRUXTON_CIRCUIT_NAME,
    circuitId: THRUXTON_CIRCUIT_ID,
    format: 'Test Day',
    availability: 'unknown',
    bookingUrl: THRUXTON_TRACKDAYS_URL,
    source: 'thruxton-testing',
    externalId: `thruxton-testing:${date}`,
  }));
}

async function loadCroftTestingDays(
  fetchFn: FetchFunction,
): Promise<TestingDay[]> {
  const sitemapXml = await fetchFn(CROFT_SITEMAP_URL);
  const pageUrls = extractCroftTestingUrls(sitemapXml);
  if (pageUrls.length === 0) {
    return [];
  }

  const pages = await Promise.all(pageUrls.map((url) => fetchFn(url)));
  return pages
    .map((html, index) => parseCroftTestingPage(html, pageUrls[index]))
    .filter((day): day is TestingDay => Boolean(day));
}

export function createAngleseyTestingAdapter(
  fetchFn: FetchFunction,
): TestingAdapter {
  return {
    name: 'anglesey-testing',
    description: 'Anglesey Circuit testing feed',
    circuitIds: [ANGLESEY_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(ANGLESEY_CIRCUIT_ID)) {
        return [];
      }

      const json = await fetchFn(ANGLESEY_EVENTS_URL);
      return filterTestingDaysByDate(parseAngleseyTestingDays(json), options);
    },
  };
}

export function createCroftTestingAdapter(
  fetchFn: FetchFunction,
): TestingAdapter {
  return {
    name: 'croft-testing',
    description: 'Croft Circuit testing feed',
    circuitIds: [CROFT_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(CROFT_CIRCUIT_ID)) {
        return [];
      }

      const days = await loadCroftTestingDays(fetchFn);
      return filterTestingDaysByDate(days, options);
    },
  };
}

export function createMalloryTestingAdapter(
  fetchFn: FetchFunction,
): TestingAdapter {
  return {
    name: 'mallory-testing',
    description: 'Mallory Park testing feed',
    circuitIds: [MALLORY_PARK_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(MALLORY_PARK_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(MALLORY_EVENTS_URL);
      return filterTestingDaysByDate(parseMalloryTestingDays(html), options);
    },
  };
}

export function createThruxtonTestingAdapter(
  fetchFn: FetchFunction,
): TestingAdapter {
  return {
    name: 'thruxton-testing',
    description: 'Thruxton testing feed',
    circuitIds: [THRUXTON_CIRCUIT_ID],
    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(THRUXTON_CIRCUIT_ID)) {
        return [];
      }

      const html = await fetchFn(THRUXTON_TRACKDAYS_URL);
      return filterTestingDaysByDate(parseThruxtonTestingDays(html), options);
    },
  };
}

export const angleseyTestingAdapter =
  createAngleseyTestingAdapter(defaultTextFetch);
export const croftTestingAdapter = createCroftTestingAdapter(defaultTextFetch);
export const malloryTestingAdapter =
  createMalloryTestingAdapter(defaultTextFetch);
export const thruxtonTestingAdapter =
  createThruxtonTestingAdapter(defaultTextFetch);
