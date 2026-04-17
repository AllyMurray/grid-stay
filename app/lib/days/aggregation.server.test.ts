import { describe, expect, it } from 'vitest';
import {
  filterAvailableDays,
  listAvailableDays,
  listCircuitOptions,
} from './aggregation.server';

describe('listAvailableDays', () => {
  it('normalizes and sorts race, test, and track days', async () => {
    const result = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [
        {
          dayId: 'race:caterham:2026-05-10:academy-1',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Snetterton',
          provider: 'Caterham Motorsport',
          description: 'Academy',
          source: { sourceType: 'caterham', sourceName: 'caterham' },
        },
      ],
      testingAdapters: [
        {
          name: 'testing-a',
          description: 'Testing adapter',
          circuitIds: ['a'],
          async fetchSchedule() {
            return [
              {
                date: '2026-04-14',
                circuitName: 'Silverstone',
                circuitId: 'a',
                format: 'Open pit lane',
                availability: 'available',
                bookingUrl: 'https://example.com/silverstone/testing',
                source: 'silverstone',
              },
            ];
          },
        },
      ],
      trackDayAdapters: [
        {
          name: 'track-a',
          description: 'Track day adapter',
          circuitIds: ['b'],
          async fetchSchedule() {
            return [
              {
                date: '2026-04-22',
                circuitName: 'Donington Park',
                circuitId: 'b',
                organizer: 'Javelin',
                availability: 'available',
                bookingUrl: 'https://example.com/donington/trackday',
                source: 'msv-trackday',
              },
            ];
          },
        },
      ],
    });

    expect(result.errors).toEqual([]);
    expect(result.days.map((day) => [day.date, day.type, day.circuit])).toEqual(
      [
        ['2026-04-14', 'test_day', 'Silverstone'],
        ['2026-04-22', 'track_day', 'Donington Park'],
        ['2026-05-10', 'race_day', 'Snetterton'],
      ],
    );
    expect(result.days[0]?.bookingUrl).toBe(
      'https://example.com/silverstone/testing',
    );
    expect(result.days[1]?.bookingUrl).toBe(
      'https://example.com/donington/trackday',
    );
    expect(result.days[2]?.bookingUrl).toBeUndefined();
  });

  it('keeps distinct track day sessions on the same circuit and date', async () => {
    const result = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [],
      testingAdapters: [],
      trackDayAdapters: [
        {
          name: 'track-a',
          description: 'Track day adapter',
          circuitIds: ['b'],
          async fetchSchedule() {
            return [
              {
                date: '2026-04-20',
                circuitName: 'Donington Park',
                circuitId: 'b',
                layout: 'National',
                organizer: 'MSV Car Trackdays',
                format: 'General Track Evening',
                duration: 'Evening',
                availability: 'available',
                bookingUrl: 'https://example.com/donington/evening',
                source: 'msv-trackday',
              },
              {
                date: '2026-04-20',
                circuitName: 'Donington Park',
                circuitId: 'b',
                layout: 'National',
                organizer: 'MSV Car Trackdays',
                format: 'General Track Day',
                duration: 'Full Day',
                availability: 'available',
                bookingUrl: 'https://example.com/donington/day',
                source: 'msv-trackday',
              },
            ];
          },
        },
      ],
    });

    expect(result.days).toHaveLength(2);
    expect(new Set(result.days.map((day) => day.dayId)).size).toBe(2);
    expect(result.days.map((day) => day.description)).toEqual([
      'National • General Track Evening • Evening',
      'National • General Track Day • Full Day',
    ]);
  });

  it('keeps the same day id when a source record date changes but external id stays the same', async () => {
    const createTestingAdapter = (date: string) => ({
      name: 'testing-a',
      description: 'Testing adapter',
      circuitIds: ['a'],
      async fetchSchedule() {
        return [
          {
            date,
            circuitName: 'Silverstone',
            circuitId: 'a',
            format: 'Open pit lane',
            availability: 'available' as const,
            source: 'silverstone',
            externalId: 'silverstone-open-pit-lane-1',
          },
        ];
      },
    });

    const first = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [],
      testingAdapters: [createTestingAdapter('2026-04-14')],
      trackDayAdapters: [],
    });
    const second = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [],
      testingAdapters: [createTestingAdapter('2026-04-15')],
      trackDayAdapters: [],
    });

    expect(first.days).toHaveLength(1);
    expect(second.days).toHaveLength(1);
    expect(first.days[0]?.dayId).toBe(second.days[0]?.dayId);
  });

  it('surfaces partial source failures without hiding successful results', async () => {
    const result = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [
        {
          dayId: 'race:1',
          date: '2026-05-10',
          type: 'race_day',
          circuit: 'Croft',
          provider: 'Caterham Motorsport',
          description: 'Race weekend',
          source: { sourceType: 'caterham', sourceName: 'caterham' },
        },
      ],
      testingAdapters: [
        {
          name: 'broken-testing',
          description: 'Broken testing adapter',
          circuitIds: ['broken'],
          async fetchSchedule() {
            throw new Error('Testing feed timed out');
          },
        },
      ],
      trackDayAdapters: [],
    });

    expect(result.days).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        source: 'testing',
        message: 'Testing feed timed out',
      },
    ]);
  });

  it('maps newly added testing sources to the correct provider labels', async () => {
    const result = await listAvailableDays({
      today: '2026-04-01',
      fetchRaceDays: async () => [],
      testingAdapters: [
        {
          name: 'anglesey-testing',
          description: 'Anglesey testing adapter',
          circuitIds: ['anglesey'],
          async fetchSchedule() {
            return [
              {
                date: '2026-11-05',
                circuitName: 'Anglesey',
                circuitId: 'anglesey',
                format: 'General Testing',
                availability: 'unknown' as const,
                source: 'anglesey-testing',
              },
            ];
          },
        },
      ],
      trackDayAdapters: [],
    });

    expect(result.days).toEqual([
      expect.objectContaining({
        circuit: 'Anglesey',
        provider: 'Anglesey Circuit',
      }),
    ]);
  });
});

describe('filterAvailableDays', () => {
  it('filters by month, circuit, provider, and type', () => {
    const days = [
      {
        dayId: '1',
        date: '2026-04-14',
        type: 'test_day',
        circuit: 'Silverstone',
        provider: 'Silverstone',
        description: '',
        source: { sourceType: 'testing', sourceName: 'silverstone' },
      },
      {
        dayId: '2',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: '',
        source: { sourceType: 'caterham', sourceName: 'caterham' },
      },
    ] as const;

    expect(
      filterAvailableDays([...days], {
        month: '2026-04',
        circuit: 'Silverstone',
        provider: 'Silverstone',
        type: 'test_day',
      }),
    ).toHaveLength(1);
  });

  it('matches circuit layout variants when filtering by the base circuit name', () => {
    const days = [
      {
        dayId: '1',
        date: '2026-04-14',
        type: 'track_day',
        circuit: 'Brands Hatch Indy',
        provider: 'MSV Trackdays',
        description: '',
        source: { sourceType: 'trackdays', sourceName: 'msv-trackday' },
      },
      {
        dayId: '2',
        date: '2026-04-21',
        type: 'track_day',
        circuit: 'Brands Hatch',
        provider: 'MSV Trackdays',
        description: '',
        source: { sourceType: 'trackdays', sourceName: 'msv-trackday' },
      },
      {
        dayId: '3',
        date: '2026-05-10',
        type: 'race_day',
        circuit: 'Snetterton',
        provider: 'Caterham Motorsport',
        description: '',
        source: { sourceType: 'caterham', sourceName: 'caterham' },
      },
    ] as const;

    expect(
      filterAvailableDays([...days], {
        circuit: 'Brands Hatch',
      }).map((day) => day.dayId),
    ).toEqual(['1', '2']);
  });
});

describe('listCircuitOptions', () => {
  it('deduplicates layout variants down to the base circuit name', () => {
    expect(
      listCircuitOptions([
        { circuit: 'Brands Hatch Indy' },
        { circuit: 'Brands Hatch' },
        { circuit: 'Brands Hatch GP' },
        { circuit: 'Silverstone GP' },
        { circuit: 'Silverstone International' },
        { circuit: 'Donington Park National' },
      ]),
    ).toEqual(['Brands Hatch', 'Donington Park', 'Silverstone']);
  });
});
