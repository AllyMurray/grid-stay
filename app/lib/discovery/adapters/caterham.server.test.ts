import { describe, expect, it } from 'vitest';
import { getSeriesRounds, parseCalendarFromHtml } from './caterham.server';

describe('Caterham calendar adapter', () => {
  it('normalizes Snetterton layout variants to the base circuit', () => {
    const events = parseCalendarFromHtml(`
      <table>
        <tr class="fs-table-row">
          <td data-order="11-12 April">11-12 April</td>
          <td data-order="Sntterton 300">Sntterton 300</td>
          <td data-order="RACE WEEKEND">Race weekend</td>
          <td data-order="ACADEMY">Academy</td>
        </tr>
        <tr class="fs-table-row">
          <td data-order="18-19 April">18-19 April</td>
          <td data-order="Snetterton 300">Snetterton 300</td>
          <td data-order="RACE WEEKEND">Race weekend</td>
          <td data-order="ACADEMY">Academy</td>
        </tr>
      </table>
    `);

    const rounds = getSeriesRounds(events, 'ACADEMY');

    expect(rounds.map((round) => round.circuit)).toEqual([
      'Snetterton',
      'Snetterton',
    ]);
    expect(rounds.map((round) => round.name)).toEqual([
      'Round 1 - Snetterton 300',
      'Round 2 - Snetterton 300',
    ]);
    expect(rounds.map((round) => round.layout)).toEqual(['300', '300']);
  });
});
