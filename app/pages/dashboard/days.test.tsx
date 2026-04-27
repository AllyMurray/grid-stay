import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type {
  DaysFeedData,
  DaysIndexData,
} from '~/lib/days/dashboard-feed.server';
import type { DayAttendanceSummary } from '~/lib/days/types';
import { theme } from '~/theme';
import { AvailableDaysPage } from './days';

function renderWithProviders(
  ui: React.ReactElement,
  initialEntry = '/dashboard/days',
  attendanceByDay: Record<
    string,
    DayAttendanceSummary
  > = defaultAttendanceByDay,
  feedPagesByOffset: Record<number, DaysFeedData> = {},
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/days',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/api/days/:dayId/attendees',
      loader({ params }) {
        return (
          attendanceByDay[params.dayId ?? ''] ?? {
            attendeeCount: 0,
            attendees: [],
            accommodationNames: [],
          }
        );
      },
      Component: () => null,
    },
    {
      path: '/api/dashboard/days-feed',
      loader({ request }) {
        const offset = Number(
          new URL(request.url).searchParams.get('offset') ?? '0',
        );

        return (
          feedPagesByOffset[offset] ?? {
            filterKey: '',
            offset,
            totalCount: defaultData.totalCount,
            nextOffset: null,
            days: [],
            attendanceSummaries: {},
          }
        );
      },
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={[initialEntry]} />);
}

const defaultData: DaysIndexData = {
  filterKey: '',
  offset: 0,
  totalCount: 2,
  nextOffset: null,
  refreshedAt: '2026-04-15T10:30:00.000Z',
  canCreateManualDays: false,
  filters: {
    month: '',
    series: '',
    circuits: [],
    provider: '',
    type: '',
  },
  monthOptions: ['2026-05'],
  seriesOptions: [],
  circuitOptions: ['Silverstone'],
  providerOptions: ['MSV'],
  savedFilters: null,
  raceSeriesByDayId: {},
  myBookingsByDay: {},
  selectedDay: null,
  selectedDayPosition: null,
  selectedDayPrevious: null,
  selectedDayNext: null,
  selectedDaySummary: null,
  selectedDayAttendance: null,
  attendanceSummaries: {
    'day-1': {
      attendeeCount: 2,
      accommodationNames: ['Trackside Hotel'],
    },
    'day-2': {
      attendeeCount: 1,
      accommodationNames: ['Brands Hatch Lodge'],
    },
  },
  days: [
    {
      dayId: 'day-1',
      date: '2026-05-03',
      type: 'race_day',
      circuit: 'Silverstone',
      provider: 'MSV',
      description: 'GT weekend',
    },
    {
      dayId: 'day-2',
      date: '2026-05-07',
      type: 'track_day',
      circuit: 'Brands Hatch',
      provider: 'Focus Trackdays',
      description: 'Open pit lane',
      bookingUrl: 'https://example.com/brands-hatch/book',
    },
  ],
};

const defaultAttendanceByDay: Record<string, DayAttendanceSummary> = {
  'day-1': {
    attendeeCount: 2,
    accommodationNames: ['Trackside Hotel'],
    attendees: [
      {
        bookingId: 'booking-1',
        userId: 'user-1',
        userName: 'Driver One',
        status: 'booked',
        accommodationName: 'Trackside Hotel',
      },
      {
        bookingId: 'booking-2',
        userId: 'user-2',
        userName: 'Driver Two',
        status: 'maybe',
      },
      {
        bookingId: 'booking-3',
        userId: 'user-3',
        userName: 'Driver Three',
        status: 'cancelled',
        accommodationName: 'Trackside Hotel',
      },
    ],
  },
  'day-2': {
    attendeeCount: 1,
    accommodationNames: ['Brands Hatch Lodge'],
    attendees: [
      {
        bookingId: 'booking-4',
        userId: 'user-4',
        userName: 'Driver Four',
        status: 'booked',
        accommodationName: 'Brands Hatch Lodge',
      },
    ],
  },
};

describe('AvailableDaysPage', () => {
  it('renders the live schedule from props', () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    expect(
      screen.getByRole('heading', { name: 'Available Days' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 attending/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /^maybe$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^booked$/i }),
    ).not.toBeInTheDocument();
  });

  it('surfaces same-day session labels directly on the list rows', () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          totalCount: 2,
          days: [
            {
              dayId: 'day-a',
              date: '2026-04-20',
              type: 'track_day',
              circuit: 'Donington Park',
              provider: 'MSV Car Trackdays',
              description:
                'National • MSV Car Trackdays - General Track Day • Full Day',
            },
            {
              dayId: 'day-b',
              date: '2026-04-20',
              type: 'track_day',
              circuit: 'Donington Park',
              provider: 'MSV Car Trackdays',
              description:
                'National • MSV Car Trackdays - General Track Evening • Evening',
            },
          ],
          attendanceSummaries: {
            'day-a': {
              attendeeCount: 2,
              accommodationNames: ['Trackside Hotel'],
            },
            'day-b': {
              attendeeCount: 0,
              accommodationNames: [],
            },
          },
        }}
      />,
    );

    expect(screen.getByText('Full Day')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();
    expect(
      screen.getByText('National • MSV Car Trackdays - General Track Day'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('National • MSV Car Trackdays - General Track Evening'),
    ).toBeInTheDocument();
  });

  it('shows month filters with readable month and year labels', () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          filters: {
            ...defaultData.filters,
            month: '2026-05',
          },
          monthOptions: ['2026-04', '2026-05'],
        }}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveDisplayValue(
      'May 2026',
    );
  });

  it('renders selected circuit filters as repeatable form values', () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          filters: {
            ...defaultData.filters,
            circuits: ['Brands Hatch', 'Silverstone'],
          },
          circuitOptions: ['Brands Hatch', 'Donington Park', 'Silverstone'],
        }}
      />,
    );

    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    const filtersForm = screen.getByRole('form', {
      name: 'Available days filters',
    });
    expect(
      Array.from(
        filtersForm.querySelectorAll<HTMLInputElement>('input[name="circuit"]'),
      ).map((input) => input.value),
    ).toEqual(['Brands Hatch', 'Silverstone']);
  });

  it('limits selected circuit filter values to the selected race series options', async () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          filters: {
            ...defaultData.filters,
            series: 'caterham-academy',
            circuits: ['Snetterton', 'Silverstone'],
          },
          seriesOptions: [
            {
              value: 'caterham-academy',
              label: 'Caterham Academy',
              circuitOptions: ['Brands Hatch', 'Snetterton'],
            },
            {
              value: 'caterham-roadsport',
              label: 'Caterham Roadsport',
              circuitOptions: ['Silverstone'],
            },
          ],
          circuitOptions: ['Brands Hatch', 'Silverstone', 'Snetterton'],
        }}
      />,
    );

    expect(
      screen.getByRole('combobox', { name: 'Race series' }),
    ).toHaveDisplayValue('Caterham Academy');
    await waitFor(() => {
      expect(
        Array.from(
          screen
            .getByRole('form', { name: 'Available days filters' })
            .querySelectorAll<HTMLInputElement>('input[name="circuit"]'),
        ).map((input) => input.value),
      ).toEqual(['Snetterton']);
    });
  });

  it('shows saved filter controls and posts the applied filters', () => {
    const view = renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          filters: {
            month: '2026-05',
            series: 'caterham-academy',
            circuits: ['Brands Hatch', 'Snetterton'],
            provider: 'Caterham Motorsport',
            type: 'race_day',
          },
          savedFilters: {
            month: '2026-06',
            series: 'caterham-academy',
            circuits: ['Snetterton'],
            provider: '',
            type: '',
          },
          seriesOptions: [
            {
              value: 'caterham-academy',
              label: 'Caterham Academy',
              circuitOptions: ['Brands Hatch', 'Snetterton'],
            },
          ],
          providerOptions: ['Caterham Motorsport'],
          circuitOptions: ['Brands Hatch', 'Snetterton'],
        }}
      />,
    );

    expect(screen.getByText('Saved view')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Apply saved view' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/days?month=2026-06&series=caterham-academy&circuit=Snetterton',
    );

    const saveForm = screen.getByRole('form', {
      name: 'Save applied filters',
    });
    expect(
      saveForm.querySelector<HTMLInputElement>('input[name="month"]')?.value,
    ).toBe('2026-05');
    expect(
      Array.from(
        saveForm.querySelectorAll<HTMLInputElement>('input[name="circuit"]'),
      ).map((input) => input.value),
    ).toEqual(['Brands Hatch', 'Snetterton']);
    expect(
      view.container.querySelector<HTMLInputElement>(
        'input[name="intent"][value="clearSavedDaysFilters"]',
      ),
    ).toBeInTheDocument();
  });

  it('shows the manual-day management link only for allowed admins', () => {
    const view = renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          canCreateManualDays: true,
        }}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Manage manual days' }),
    ).toBeInTheDocument();

    view.unmount();
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    expect(
      screen.queryByRole('link', { name: 'Manage manual days' }),
    ).not.toBeInTheDocument();
  });

  it('does not render the source loading warning in the member feed', () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    expect(
      screen.queryByText(/Some sources could not be loaded/i),
    ).not.toBeInTheDocument();
  });

  it('updates the selected detail when another day link is opened', async () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    const brandsHatchLink = screen.getByRole('link', {
      name: /view details for brands hatch/i,
    });

    fireEvent.click(brandsHatchLink);
    expect(
      await screen.findAllByText('Thu, 7 May 2026 • Focus Trackdays'),
    ).not.toHaveLength(0);
    expect(screen.getByText('2 of 2 matching days')).toBeInTheDocument();
    expect(screen.getByText('My plan')).toBeInTheDocument();
    expect(screen.getByText('Group plan')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add as maybe/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add as booked/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /book on provider site/i }),
    ).toHaveAttribute('href', 'https://example.com/brands-hatch/book');
    expect(screen.getByText('Attendee roster')).toBeInTheDocument();
    expect(screen.queryByText('Driver Four')).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: /view booked attendees/i }),
    );
    expect((await screen.findAllByText('Driver Four')).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('shows bulk series actions for race days with a linked series', () => {
    const selectedDay = {
      ...defaultData.days[0]!,
      provider: 'Caterham Motorsport',
      description: 'Caterham Academy • Round 1',
    };

    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          selectedDay,
          selectedDayPosition: 1,
          selectedDaySummary: defaultData.attendanceSummaries['day-1'],
          selectedDayAttendance: defaultAttendanceByDay['day-1'],
          raceSeriesByDayId: {
            'day-1': {
              name: 'Caterham Academy',
              totalCount: 7,
              existingBookingCount: 2,
            },
          },
        }}
      />,
      '/dashboard/days?day=day-1',
    );

    expect(screen.getByText('Caterham Academy')).toBeInTheDocument();
    expect(
      screen.getByText('7 events in the series • 2 already in My Bookings'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add missing as maybe/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /add missing as booked/i }),
    ).toBeVisible();
  });

  it('uses non-actionable series copy when every linked race round is already booked', () => {
    const selectedDay = {
      dayId: 'manual:drift-day',
      date: '2026-04-22',
      type: 'track_day' as const,
      circuit: 'Brands Hatch',
      provider: 'Caterham Motorsport',
      description: 'Drift Day',
    };

    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          days: [selectedDay, ...defaultData.days],
          selectedDay,
          selectedDayPosition: 2,
          selectedDaySummary: {
            attendeeCount: 0,
            accommodationNames: [],
          },
          selectedDayAttendance: {
            attendeeCount: 0,
            accommodationNames: [],
            attendees: [],
          },
          raceSeriesByDayId: {
            'manual:drift-day': {
              name: 'Caterham Academy',
              totalCount: 5,
              existingBookingCount: 5,
            },
          },
        }}
      />,
      '/dashboard/days?day=manual%3Adrift-day',
    );

    expect(
      screen.getByText('5 events in the series • 5 already in My Bookings'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'All linked events from this series are already in My Bookings.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add missing as maybe/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /add missing as booked/i }),
    ).not.toBeInTheDocument();
  });

  it('moves between loaded matching days from the selected-day header', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-1',
    );

    expect(await screen.findByText('1 of 2 matching days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(
      screen.queryByRole('link', { name: /book on provider site/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /next/i })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-2',
    );

    fireEvent.click(screen.getByRole('link', { name: /next/i }));

    expect(await screen.findByText('2 of 2 matching days')).toBeInTheDocument();
    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-1',
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('uses route-provided neighbors when the selected day is outside the initially loaded page', async () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          totalCount: 4,
          days: [defaultData.days[0]!, defaultData.days[1]!],
          selectedDay: {
            dayId: 'day-4',
            date: '2026-05-12',
            type: 'race_day',
            circuit: 'Donington Park',
            provider: 'MSV',
            description: 'Race weekend',
          },
          selectedDayPosition: 4,
          selectedDayPrevious: {
            dayId: 'day-3',
            date: '2026-05-09',
            type: 'test_day',
            circuit: 'Oulton Park',
            provider: 'MSV',
            description: 'Test session',
          },
          selectedDayNext: null,
          selectedDaySummary: {
            attendeeCount: 0,
            accommodationNames: [],
          },
          selectedDayAttendance: {
            attendeeCount: 0,
            accommodationNames: [],
            attendees: [],
          },
          attendanceSummaries: {
            ...defaultData.attendanceSummaries,
            'day-4': {
              attendeeCount: 0,
              accommodationNames: [],
            },
          },
        }}
      />,
      '/dashboard/days?day=day-4',
      defaultAttendanceByDay,
      {
        3: {
          filterKey: '',
          offset: 3,
          totalCount: 4,
          nextOffset: null,
          days: [],
          attendanceSummaries: {},
        },
      },
    );

    expect(await screen.findByText('4 of 4 matching days')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-3&nav=day-3',
    );
  });

  it('shows a compact roster first and expands one status group at a time', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-2',
    );

    await screen.findByText('Attendee roster');
    expect(screen.queryByText('Driver Four')).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByRole('button', { name: /view booked attendees/i }),
    );

    expect((await screen.findAllByText('Driver Four')).length).toBeGreaterThan(
      0,
    );

    expect(screen.getAllByText('Brands Hatch Lodge').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
  });

  it('shows the header action as open my booking when a trip already exists', async () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          myBookingsByDay: {
            'day-1': {
              bookingId: 'booking-1',
              status: 'booked',
              accommodationName: 'Trackside Hotel',
            },
          },
        }}
      />,
      '/dashboard/days?day=day-1',
    );

    expect(await screen.findByText('My plan')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^open my booking$/i }),
    ).toHaveAttribute('href', '/dashboard/bookings');
    expect(screen.getByText('Trackside Hotel')).toBeInTheDocument();
    expect(screen.getByText('1 saved stay')).toBeInTheDocument();
  });

  it('offers saved shared stays as direct actions in the selected-day view', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-1',
    );

    expect(
      await screen.findByRole('button', { name: /join stay/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Your state').length).toBeGreaterThan(0);
    expect(screen.getByText('Not in your plan')).toBeInTheDocument();
    expect(screen.getAllByText('Trackside Hotel').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Wait for someone to name the stay.'),
    ).toBeInTheDocument();
  });

  it('renders the empty state when no rows match', () => {
    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          totalCount: 0,
          days: [],
          attendanceSummaries: {},
        }}
      />,
    );

    expect(
      screen.getByText(/no days match those filters/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /show the full feed/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });
});
