/**
 * Knockhill testing day adapter.
 * Fetches calendar via AJAX endpoint https://www.knockhill.com/ajax/getTestCal.php
 *
 * Two-phase parsing:
 * 1. Calendar dates from AJAX HTML (onclick="loadTestClass('YYYY-MM-DD')")
 * 2. Session details via POST /ajax/getTestlist.php
 */
import type {
  FetchFunction,
  TestingAdapter,
  TestingDay,
  TestingFetchOptions,
} from '../types';

const KNOCKHILL_CIRCUIT_ID = '01HQ8VXMN0KNOCKHILL';

export const KNOCKHILL_URL = 'https://www.knockhill.com/testing/Car-Testing';
export const KNOCKHILL_AJAX_CAL_URL =
  'https://www.knockhill.com/ajax/getTestCal.php';
export const KNOCKHILL_AJAX_URL =
  'https://www.knockhill.com/ajax/getTestlist.php';

/** Knockhill fixture/category IDs for car testing calendar */
const KNOCKHILL_FIX_ID = '944';
const KNOCKHILL_FIXCAT_ID = '5';

/**
 * A date entry parsed from the Knockhill calendar grid.
 */
export interface KnockhillCalendarDate {
  date: string;
  availability: TestingDay['availability'];
}

/**
 * A session parsed from the Knockhill AJAX response.
 */
export interface KnockhillSession {
  name: string;
  time?: string;
  className?: string;
  pricePennies?: number;
  availability?: TestingDay['availability'];
}

/**
 * Parses dates from the Knockhill calendar grid HTML.
 *
 * Dates use: onclick="loadTestClass('YYYY-MM-DD')" on elements with class `viewdate showday`.
 * Availability via CSS: `viewdate showday` (no colour) = available, `orange` = limited, `lightred` = sold out.
 */
export function parseKnockhillCalendar(html: string): KnockhillCalendarDate[] {
  const dates: KnockhillCalendarDate[] = [];

  // Match elements with onclick="loadTestClass('YYYY-MM-DD')"
  const pattern =
    /<[^>]*class="([^"]*)"[^>]*onclick="loadTestClass\('(\d{4}-\d{2}-\d{2})'\)"[^>]*>/gi;

  for (const match of html.matchAll(pattern)) {
    const classes = match[1];
    const date = match[2];

    // Only include elements with viewdate and showday classes
    if (!classes.includes('viewdate') || !classes.includes('showday')) {
      continue;
    }

    let availability: TestingDay['availability'] = 'available';
    if (classes.includes('lightred')) {
      availability = 'sold_out';
    } else if (classes.includes('orange')) {
      availability = 'limited';
    }

    dates.push({ date, availability });
  }

  return dates;
}

/**
 * Decodes common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&pound;/g, '£');
}

/**
 * Strips HTML tags and decodes entities.
 */
function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, '').trim());
}

/**
 * Parses session details from the Knockhill AJAX response HTML.
 *
 * Real HTML structure: session name (h3) and time (h4) sit in a `.fixname` div
 * *before* the eventboxes. Each eventbox contains group (h4), price (h5), and
 * a booking button whose text indicates availability.
 */
export function parseKnockhillSessions(html: string): KnockhillSession[] {
  const sessions: KnockhillSession[] = [];
  const hasFixname = /<div[^>]*class="[^"]*fixname[^"]*"[^>]*>/i.test(html);

  if (hasFixname) {
    // Split into session blocks at fixname boundaries
    const blocks = html.split(/<div[^>]*class="[^"]*fixname[^"]*"[^>]*>/i);

    for (const block of blocks) {
      // Session name from h3 (inside the fixname div)
      const nameMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const name = nameMatch ? stripHtml(nameMatch[1]) : undefined;
      if (!name) continue;

      // Time from h4 before the first eventbox
      const preEventbox = block.split(
        /<div[^>]*class="[^"]*eventbox[^"]*"/i,
      )[0];
      const timeMatch = preEventbox?.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
      const time = timeMatch ? stripHtml(timeMatch[1]) : undefined;

      // Split at eventbox boundaries
      const eventboxParts = block.split(
        /<div[^>]*class="[^"]*eventbox[^"]*"[^>]*>/i,
      );

      if (eventboxParts.length <= 1) {
        // No eventboxes — just use the session name/time
        sessions.push({ name, time });
        continue;
      }

      // Process each eventbox (skip index 0 which is pre-eventbox content)
      for (let i = 1; i < eventboxParts.length; i++) {
        const content = eventboxParts[i];

        // Group from h4
        const groupMatch = content.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
        const className = groupMatch ? stripHtml(groupMatch[1]) : undefined;

        // Price from h5 matching £ or &pound;
        const priceMatch = content.match(/(?:£|&pound;)(\d+(?:\.\d{2})?)/);
        const pricePennies = priceMatch
          ? Math.round(Number.parseFloat(priceMatch[1]) * 100)
          : undefined;

        // Per-session availability from button text
        const buttonMatch = content.match(/<button[^>]*>([\s\S]*?)<\/button>/i);
        const buttonText = buttonMatch ? stripHtml(buttonMatch[1]) : undefined;
        let availability: TestingDay['availability'] | undefined;
        if (buttonText) {
          if (buttonText.toLowerCase().includes('full')) {
            availability = 'sold_out';
          } else if (buttonText.toLowerCase().includes('book')) {
            availability = 'available';
          }
        }

        sessions.push({ name, time, className, pricePennies, availability });
      }
    }
  } else {
    // Fallback: no fixname divs, try bare h3 extraction
    const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    for (const h3Match of html.matchAll(h3Pattern)) {
      const name = stripHtml(h3Match[1]);
      if (name) {
        sessions.push({ name });
      }
    }
  }

  return sessions;
}

/**
 * Default fetch for Knockhill (supports POST for AJAX).
 */
async function defaultFetch(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'text/html',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

/**
 * Fetches session details for a single testing date.
 * Returns [] on failure so callers can fall back to a bare entry.
 */
async function fetchSessionsForDate(
  fetchFn: FetchFunction,
  date: string,
): Promise<KnockhillSession[]> {
  try {
    const body = new URLSearchParams({
      fix_Id: KNOCKHILL_FIX_ID,
      fixcat_Id: KNOCKHILL_FIXCAT_ID,
      date,
    });

    const html = await fetchFn(KNOCKHILL_AJAX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    return parseKnockhillSessions(html);
  } catch {
    return [];
  }
}

/**
 * Filters dates by options.
 */
function filterDates(
  dates: KnockhillCalendarDate[],
  options?: TestingFetchOptions,
): KnockhillCalendarDate[] {
  let filtered = dates;
  if (options?.fromDate) {
    filtered = filtered.filter((d) => d.date >= options.fromDate!);
  }
  if (options?.toDate) {
    filtered = filtered.filter((d) => d.date <= options.toDate!);
  }
  return filtered;
}

/**
 * Returns an array of YYYY-MM-DD strings for the 1st of each month
 * spanning from `fromDate` to `toDate` (inclusive of their months).
 */
export function getMonthStarts(fromDate: string, toDate: string): string[] {
  const starts: string[] = [];
  const start = new Date(`${fromDate.slice(0, 7)}-01`);
  const endMonth = toDate.slice(0, 7);

  while (true) {
    const yyyy = start.getFullYear();
    const mm = String(start.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}-${mm}`;
    starts.push(`${key}-01`);
    if (key >= endMonth) break;
    start.setMonth(start.getMonth() + 1);
  }

  return starts;
}

/**
 * Creates a Knockhill adapter with injectable fetch.
 */
export function createKnockhillAdapter(fetchFn: FetchFunction): TestingAdapter {
  return {
    name: 'knockhill',
    description: 'Knockhill Racing Circuit testing days',
    circuitIds: [KNOCKHILL_CIRCUIT_ID],

    async fetchSchedule(circuitIds, options) {
      if (!circuitIds.includes(KNOCKHILL_CIRCUIT_ID)) {
        return [];
      }

      // Determine month range to query
      const fromDate =
        options?.fromDate ?? new Date().toISOString().slice(0, 10);
      const toDate = options?.toDate ?? `${new Date().getFullYear()}-12-31`;
      const months = getMonthStarts(fromDate, toDate);

      // Fetch calendar HTML for each month via AJAX endpoint
      const allDates = new Map<string, KnockhillCalendarDate>();

      for (const monthStart of months) {
        const body = new URLSearchParams({
          fix_Id: KNOCKHILL_FIX_ID,
          fixcat_Id: KNOCKHILL_FIXCAT_ID,
          date: monthStart,
        });

        const html = await fetchFn(KNOCKHILL_AJAX_CAL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        for (const entry of parseKnockhillCalendar(html)) {
          // Deduplicate — keep best availability if seen across months
          if (!allDates.has(entry.date)) {
            allDates.set(entry.date, entry);
          }
        }
      }

      const calendarDates = [...allDates.values()];
      const filteredDates = filterDates(calendarDates, options);

      // Phase 2: Fetch session details for each date in parallel
      const sessionResults = await Promise.all(
        filteredDates.map(async (d) => {
          const sessions = await fetchSessionsForDate(fetchFn, d.date);
          return { calendarDate: d, sessions };
        }),
      );

      // Build TestingDay entries — one per session, or a bare fallback
      const days: TestingDay[] = [];
      for (const { calendarDate, sessions } of sessionResults) {
        if (sessions.length > 0) {
          for (const session of sessions) {
            days.push({
              date: calendarDate.date,
              circuitName: 'Knockhill',
              circuitId: KNOCKHILL_CIRCUIT_ID,
              availability: session.availability ?? calendarDate.availability,
              bookingUrl: KNOCKHILL_URL,
              source: 'knockhill',
              format: session.name,
              group: session.className,
              pricePennies: session.pricePennies,
            });
          }
        } else {
          days.push({
            date: calendarDate.date,
            circuitName: 'Knockhill',
            circuitId: KNOCKHILL_CIRCUIT_ID,
            availability: calendarDate.availability,
            bookingUrl: KNOCKHILL_URL,
            source: 'knockhill',
          });
        }
      }

      return days;
    },
  };
}

/**
 * Pre-configured Knockhill adapter.
 */
export const knockhillAdapter = createKnockhillAdapter(defaultFetch);
