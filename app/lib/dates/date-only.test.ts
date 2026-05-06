import { describe, expect, it } from 'vite-plus/test';
import { formatDateOnly } from './date-only';

describe('date-only formatting', () => {
  it('keeps YYYY-MM-DD values on their calendar day', () => {
    expect(
      formatDateOnly('2026-04-01', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    ).toBe('Wed, 1 April 2026');
  });
});
