import { describe, expect, it } from 'vitest';
import {
  extractCroftTrackDayUrls,
  parseAngleseyTrackDays,
  parseCastleCombeTrackDays,
  parseCroftTrackDayPage,
  parseLyddenTrackDays,
  parseMalloryTrackDays,
  parseThruxtonTrackDays,
} from './independent-venues.server';

describe('parseAngleseyTrackDays', () => {
  it('keeps car track days and ignores motorcycle events', () => {
    const json = JSON.stringify([
      {
        title: 'Javelin Trackdays',
        guid: 4624,
        organiser: ['Javelin Trackdays'],
        category: [{ slug: 'car-track-day' }],
        content: '<p><strong>Format:</strong> Open Pit Lane</p>',
        meta: {
          startdate: '2026-09-04T09:00',
          circuit: 'AM : International / PM: Coastal',
          booking: 'https://example.com/anglesey',
        },
      },
      {
        title: 'No Limits',
        guid: 4953,
        organiser: ['No Limits Trackdays'],
        category: [{ slug: 'motorcycle-trackday' }],
        meta: {
          startdate: '2026-09-26T09:00',
          circuit: 'International',
        },
      },
    ]);

    expect(parseAngleseyTrackDays(json)).toEqual([
      expect.objectContaining({
        date: '2026-09-04',
        circuitName: 'Anglesey',
        layout: 'AM : International / PM: Coastal',
        format: 'Open Pit Lane',
        organizer: 'Javelin Trackdays',
      }),
    ]);
  });
});

describe('parseCastleCombeTrackDays', () => {
  it('parses dated variants and skips additional driver entries', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "ProductGroup",
              "hasVariant": [
                {
                  "@type": "Product",
                  "name": "PistonHeads Car Track Day - Fri 12th June 2026",
                  "offers": {
                    "url": "https://castlecombecircuit.co.uk/shop/car-track-day/?attribute_choose-date=Fri+12th+June+2026"
                  }
                },
                {
                  "@type": "Product",
                  "name": "PistonHeads Car Track Day - Additional Driver",
                  "offers": {
                    "url": "https://castlecombecircuit.co.uk/shop/car-track-day/?attribute_choose-date=Additional+Driver"
                  }
                }
              ]
            }
          ]
        }
      </script>
    `;

    expect(parseCastleCombeTrackDays(html)).toEqual([
      expect.objectContaining({
        date: '2026-06-12',
        circuitName: 'Castle Combe',
        bookingUrl:
          'https://castlecombecircuit.co.uk/shop/car-track-day/?attribute_choose-date=Fri+12th+June+2026',
      }),
    ]);
  });
});

describe('parseLyddenTrackDays', () => {
  it('reads the published 2026 dates from the available dates section', () => {
    const html = `
      <h2>Available dates &#8211; 2026</h2>
      <p>
        7th February<br />
        14th November<br />
      </p>
    `;

    expect(parseLyddenTrackDays(html).map((day) => day.date)).toEqual([
      '2026-02-07',
      '2026-11-14',
    ]);
  });
});

describe('parseMalloryTrackDays', () => {
  it('keeps Javelin car track days and ignores bike days', () => {
    const html = `
      <script type="application/ld+json">
        [
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "Javelin Trackdays",
            "url": "https://www.malloryparkcircuit.com/event/javelin-trackdays-52-2025-12-06/2026-05-21/",
            "startDate": "2026-05-21T00:00:00+01:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "No Limits Trackdays",
            "url": "https://www.malloryparkcircuit.com/event/no-limits-trackdays-63-2025-10-11/2026-05-29/",
            "startDate": "2026-05-29T00:00:00+01:00"
          }
        ]
      </script>
    `;

    expect(parseMalloryTrackDays(html)).toEqual([
      expect.objectContaining({
        date: '2026-05-21',
        circuitName: 'Mallory Park',
        organizer: 'Javelin Trackdays',
      }),
    ]);
  });
});

describe('Croft track day sitemap parsing', () => {
  it('extracts track day pages from the sitemap', () => {
    const xml = `
      <urlset>
        <url><loc>https://croftcircuit.co.uk/racing/track-day-24-april</loc></url>
        <url><loc>https://croftcircuit.co.uk/racing/test-day-16mar26</loc></url>
        <url><loc>https://croftcircuit.co.uk/racing/novice-driver-track-day-20JUN25</loc></url>
      </urlset>
    `;

    expect(extractCroftTrackDayUrls(xml)).toEqual([
      'https://croftcircuit.co.uk/racing/novice-driver-track-day-20JUN25',
      'https://croftcircuit.co.uk/racing/track-day-24-april',
    ]);
  });

  it('parses car track day pages from SportsEvent schema', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": "Croft Car Track Day",
          "description": "Designed for first-time or less-experienced track day drivers.",
          "url": "https://croftcircuit.co.uk/racing/track-day-24-april",
          "startDate": "2026-04-24"
        }
      </script>
    `;

    expect(
      parseCroftTrackDayPage(
        html,
        'https://croftcircuit.co.uk/racing/track-day-24-april',
      ),
    ).toEqual(
      expect.objectContaining({
        date: '2026-04-24',
        circuitName: 'Croft',
        format: 'Croft Car Track Day',
      }),
    );
  });
});

describe('parseThruxtonTrackDays', () => {
  it('returns no events while the official page says information is coming soon', () => {
    expect(
      parseThruxtonTrackDays(
        '<h5>Test Days Available On: Information coming soon</h5>',
      ),
    ).toEqual([]);
  });
});
