import { describe, expect, it } from 'vite-plus/test';
import { extractJsonLdEntries } from './shared.server';

describe('extractJsonLdEntries', () => {
  it('parses JSON-LD scripts when the plus sign is HTML-entity encoded', () => {
    const html = `
      <script type="application/ld&#x2B;json">
        {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": "Croft Car Track Day",
          "startDate": "2026-04-24"
        }
      </script>
    `;

    expect(extractJsonLdEntries(html)).toEqual([
      expect.objectContaining({
        '@type': 'SportsEvent',
        name: 'Croft Car Track Day',
        startDate: '2026-04-24',
      }),
    ]);
  });
});
