import { describe, expect, it } from 'vite-plus/test';
import {
  extractCroftTestingUrls,
  parseAngleseyTestingDays,
  parseCroftTestingPage,
  parseMalloryTestingDays,
  parseThruxtonTestingDays,
} from './independent-venues.server';

describe('parseAngleseyTestingDays', () => {
  it('keeps general testing events from the Anglesey feed', () => {
    const json = JSON.stringify([
      {
        title: 'General Testing',
        guid: 4708,
        testday: true,
        category: [{ slug: 'general-testing' }],
        meta: {
          startdate: '2026-11-05T12:00',
          circuit: 'International',
        },
      },
      {
        title: 'Javelin Trackdays',
        guid: 4624,
        testday: false,
        category: [{ slug: 'car-track-day' }],
        meta: {
          startdate: '2026-09-04T09:00',
          circuit: 'AM : International / PM: Coastal',
        },
      },
    ]);

    expect(parseAngleseyTestingDays(json)).toEqual([
      expect.objectContaining({
        date: '2026-11-05',
        circuitName: 'Anglesey',
        layout: 'International',
        format: 'General Testing',
      }),
    ]);
  });
});

describe('parseMalloryTestingDays', () => {
  it('keeps car test days and ignores unrelated testing events', () => {
    const html = `
      <script type="application/ld+json">
        [
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "Test Day &#8211; Cars",
            "description": "&lt;p&gt;Car Test Day - Saloons &amp; Single Seaters - 103dB(A) Competition cars only.&lt;/p&gt;",
            "url": "https://www.malloryparkcircuit.com/event/test-day-cars-3/",
            "startDate": "2026-06-04T00:00:00+01:00"
          },
          {
            "@context": "http://schema.org",
            "@type": "Event",
            "name": "ARDS Testing",
            "description": "&lt;p&gt;Required course for candidates to acquire their MSUK National B race licence.&lt;/p&gt;",
            "url": "https://www.malloryparkcircuit.com/event/ards-testing-39-2025-12-02/2026-05-27/",
            "startDate": "2026-05-27T00:00:00+01:00"
          }
        ]
      </script>
    `;

    expect(parseMalloryTestingDays(html)).toEqual([
      expect.objectContaining({
        date: '2026-06-04',
        circuitName: 'Mallory Park',
        format: 'Test Day – Cars',
        group: 'Saloons & Single Seaters',
      }),
    ]);
  });
});

describe('Croft testing sitemap parsing', () => {
  it('extracts test day pages from the sitemap', () => {
    const xml = `
      <urlset>
        <url><loc>https://croftcircuit.co.uk/racing/test-day-16mar26</loc></url>
        <url><loc>https://croftcircuit.co.uk/racing/caterhamonly-testday-26jun</loc></url>
        <url><loc>https://croftcircuit.co.uk/racing/track-day-24-april</loc></url>
      </urlset>
    `;

    expect(extractCroftTestingUrls(xml)).toEqual([
      'https://croftcircuit.co.uk/racing/caterhamonly-testday-26jun',
      'https://croftcircuit.co.uk/racing/test-day-16mar26',
    ]);
  });

  it('parses SportsEvent schema from Croft test day pages', () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": "Semi-Exclusive Test Day",
          "description": "This semi-exclusive test day is for closed wheel/saloon vehicles only, including BTCC cars.",
          "url": "https://croftcircuit.co.uk/racing/test-day-16mar26",
          "startDate": "2026-03-16"
        }
      </script>
    `;

    expect(
      parseCroftTestingPage(html, 'https://croftcircuit.co.uk/racing/test-day-16mar26'),
    ).toEqual(
      expect.objectContaining({
        date: '2026-03-16',
        circuitName: 'Croft',
        format: 'Semi-Exclusive Test Day',
        group: 'closed wheel/saloon vehicles only, including BTCC cars',
      }),
    );
  });
});

describe('parseThruxtonTestingDays', () => {
  it('returns no events while the official test day section has no dates', () => {
    expect(
      parseThruxtonTestingDays('<h5>Test Days Available On: Information coming soon</h5>'),
    ).toEqual([]);
  });
});
