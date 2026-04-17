const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; GridStay/1.0; +https://gridstay.app)',
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '...',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

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
};

export interface JsonLdObject {
  [key: string]: unknown;
}

export async function defaultTextFetch(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(
      /&([a-z]+);/gi,
      (_, entity: string) =>
        NAMED_ENTITIES[entity.toLowerCase()] ?? `&${entity};`,
    );
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

export function parseBritishDate(value: string): string | undefined {
  const normalized = stripHtml(value);
  const match = normalized.match(
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*,?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i,
  );
  if (!match) {
    return undefined;
  }

  const month = MONTHS[match[2].toLowerCase()];
  if (!month) {
    return undefined;
  }

  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
}

export function parseMonthDayWithYear(
  value: string,
  year: string,
): string | undefined {
  const normalized = stripHtml(value);
  const match = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)/i);
  if (!match) {
    return undefined;
  }

  const month = MONTHS[match[2].toLowerCase()];
  if (!month) {
    return undefined;
  }

  return `${year}-${month}-${match[1].padStart(2, '0')}`;
}

export function extractHtmlLabelValue(
  html: string,
  label: string,
): string | undefined {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(
    new RegExp(
      `<strong>\\s*${escapedLabel}\\s*:\\s*<\\/strong>\\s*([^<]+)`,
      'i',
    ),
  );

  return match?.[1] ? stripHtml(match[1]) : undefined;
}

export function extractJsonLdEntries(html: string): JsonLdObject[] {
  const entries: JsonLdObject[] = [];

  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const content = match[1]?.trim();
    if (!content) {
      continue;
    }

    try {
      const parsed = JSON.parse(content) as unknown;
      entries.push(...flattenJsonLd(parsed));
    } catch {}
  }

  return entries;
}

function flattenJsonLd(value: unknown): JsonLdObject[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenJsonLd(entry));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const object = value as JsonLdObject;
  const graph = object['@graph'];
  if (Array.isArray(graph)) {
    return flattenJsonLd(graph);
  }

  return [object];
}
