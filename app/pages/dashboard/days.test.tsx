import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type {
  DaysFeedData,
  DaysIndexData,
} from '~/lib/days/dashboard-feed.server';
import type { DayAttendanceSummary } from '~/lib/days/types';
import type { EventCostSummary } from '~/lib/db/services/cost-splitting.server';
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
  action: (args: ActionFunctionArgs) => Promise<unknown> = async () => null,
  costSummaryByDay: Record<string, EventCostSummary | null> = {},
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/days',
      action,
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
      path: '/api/days/:dayId/costs',
      loader({ params }) {
        return costSummaryByDay[params.dayId ?? ''] ?? null;
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

const defaultCostSummary: EventCostSummary = {
  dayId: 'day-1',
  currency: 'GBP',
  availableParticipants: [
    { userId: 'user-1', userName: 'Driver One' },
    { userId: 'user-2', userName: 'Driver Two' },
  ],
  totalPence: 10_000,
  groups: [
    {
      groupId: 'garage',
      dayId: 'day-1',
      name: 'Garage 4',
      category: 'garage',
      participants: [
        { userId: 'user-1', userName: 'Driver One' },
        { userId: 'user-2', userName: 'Driver Two' },
      ],
      totalPence: 10_000,
      currency: 'GBP',
      expenses: [
        {
          expenseId: 'expense-1',
          groupId: 'garage',
          dayId: 'day-1',
          title: 'Garage booking',
          amountPence: 10_000,
          currency: 'GBP',
          paidByUserId: 'user-2',
          paidByName: 'Driver Two',
          createdByUserId: 'user-2',
          createdByName: 'Driver Two',
          createdAt: '2026-05-01T10:00:00.000Z',
          updatedAt: '2026-05-01T10:00:00.000Z',
          canEdit: false,
        },
      ],
      createdByUserId: 'user-2',
      createdByName: 'Driver Two',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
      canEdit: false,
    },
  ],
  netSettlements: [
    {
      settlementId: 'day-1#user-1#user-2#GBP',
      dayId: 'day-1',
      debtorUserId: 'user-1',
      debtorName: 'Driver One',
      creditorUserId: 'user-2',
      creditorName: 'Driver Two',
      amountPence: 5000,
      currency: 'GBP',
      status: 'open',
      breakdownHash: 'hash-1',
      breakdown: [
        {
          groupId: 'garage',
          groupName: 'Garage 4',
          debtorSharePence: 5000,
          creditorSharePence: 5000,
        },
      ],
      paymentPreference: {
        label: 'Monzo',
        url: 'https://monzo.me/driver-two',
      },
      canMarkSent: true,
      canConfirmReceived: false,
    },
  ],
};

const defaultData: DaysIndexData = {
  currentUser: {
    id: 'user-1',
    name: 'Driver One',
  },
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
  selectedDayPlan: null,
  selectedDayCostSummary: null,
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
    expect(screen.getByText('2 matching days')).toBeInTheDocument();
    expect(screen.getByText('No filters')).toBeInTheDocument();
    expect(screen.queryByText(/Circuits tracked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Providers tracked/i)).not.toBeInTheDocument();
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
            notifyOnNewMatches: true,
            externalChannel: '',
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
    expect(screen.getByLabelText('Use for notifications')).toBeChecked();
    expect(
      screen.getByText('Notifications limited to this saved view'),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('External alert channel'),
    ).not.toBeInTheDocument();
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
      await screen.findByRole(
        'button',
        { name: /view booked attendees/i },
        { timeout: 3000 },
      ),
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
              key: 'caterham-academy',
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
      screen.getByRole('link', { name: 'Open series page' }),
    ).toHaveAttribute('href', '/dashboard/series/caterham-academy');
    expect(
      screen.getByRole('button', { name: /add missing as maybe/i }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: /add missing as booked/i }),
    ).toBeVisible();
  });

  it('renders and submits the shared planning note for a selected day', async () => {
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          selectedDay: defaultData.days[0]!,
          selectedDayPosition: 1,
          selectedDaySummary: defaultData.attendanceSummaries['day-1'],
          selectedDayAttendance: defaultAttendanceByDay['day-1'],
          selectedDayPlan: {
            dayId: 'day-1',
            notes: 'Meet by garage 4.',
            dinnerPlan: 'Dinner at 19:30.',
            carShare: 'Two spaces from hotel.',
            checklist: 'Tickets and wristbands.',
            costSplit: 'Settle fuel after the weekend.',
            updatedByName: 'Driver One',
            updatedAt: '2026-04-27T10:00:00.000Z',
          },
        }}
      />,
      '/dashboard/days?day=day-1',
      defaultAttendanceByDay,
      {},
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return {
          ok: true,
          plan: null,
        };
      },
    );

    const note = await screen.findByRole('textbox', {
      name: 'Shared planning note',
    });
    expect(note).toHaveDisplayValue('Meet by garage 4.');
    expect(screen.getByLabelText('Dinner')).toHaveDisplayValue(
      'Dinner at 19:30.',
    );
    expect(screen.getByLabelText('Car share')).toHaveDisplayValue(
      'Two spaces from hotel.',
    );
    expect(screen.getByText('Updated by Driver One')).toBeInTheDocument();

    fireEvent.change(note, {
      target: { value: 'Meet by garage 6.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save shared plan' }));

    await waitFor(() =>
      expect(submitted).toEqual({
        intent: 'saveSharedDayPlan',
        dayId: 'day-1',
        notes: 'Meet by garage 6.',
        dinnerPlan: 'Dinner at 19:30.',
        carShare: 'Two spaces from hotel.',
        checklist: 'Tickets and wristbands.',
        costSplit: 'Settle fuel after the weekend.',
      }),
    );
  });

  it('renders event cost groups and submits settlement status updates', async () => {
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          selectedDay: defaultData.days[0]!,
          selectedDayPosition: 1,
          selectedDaySummary: defaultData.attendanceSummaries['day-1'],
          selectedDayAttendance: defaultAttendanceByDay['day-1'],
          selectedDayCostSummary: defaultCostSummary,
        }}
      />,
      '/dashboard/days?day=day-1',
      defaultAttendanceByDay,
      {},
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    expect(screen.getByText('Cost splitting')).toBeInTheDocument();
    expect(screen.getByText('Driver One pays Driver Two')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Monzo' })).toHaveAttribute(
      'href',
      'https://monzo.me/driver-two',
    );
    expect(screen.getByText('Garage booking')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark sent' }));

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'updateCostSettlement',
          dayId: 'day-1',
          debtorUserId: 'user-1',
          creditorUserId: 'user-2',
          amountPence: '5000',
          currency: 'GBP',
          breakdownHash: 'hash-1',
          status: 'sent',
        }),
      ),
    );
  });

  it('loads event costs when a day is selected without route revalidation', async () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-1',
      defaultAttendanceByDay,
      {},
      async () => null,
      {
        'day-1': defaultCostSummary,
      },
    );

    expect(screen.getByText('Loading cost splitting')).toBeInTheDocument();

    expect(await screen.findByText('Driver One pays Driver Two')).toBeVisible();
    expect(screen.getByText('Garage booking')).toBeVisible();
    expect(
      screen.queryByText(
        'Cost groups load when this day is opened directly from the dashboard.',
      ),
    ).not.toBeInTheDocument();
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
              key: 'caterham-academy',
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
              userId: 'user-1',
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

  it('submits garage share requests from the selected-day view', async () => {
    let submitted: Record<string, FormDataEntryValue> | null = null;

    renderWithProviders(
      <AvailableDaysPage
        data={{
          ...defaultData,
          myBookingsByDay: {
            'day-1': {
              bookingId: 'booking-1',
              userId: 'user-1',
              status: 'booked',
            },
          },
        }}
      />,
      '/dashboard/days?day=day-1',
      {
        ...defaultAttendanceByDay,
        'day-1': {
          ...defaultAttendanceByDay['day-1']!,
          garageOwnerCount: 1,
          garageOpenSpaceCount: 1,
          garageShareOptions: [
            {
              garageBookingId: 'booking-2',
              ownerUserId: 'user-2',
              ownerName: 'Driver Two',
              garageLabel: 'Garage 4',
              garageCapacity: 2,
              approvedRequestCount: 0,
              pendingRequestCount: 0,
              openSpaceCount: 1,
              requests: [],
            },
          ],
        },
      },
      {},
      async ({ request }) => {
        submitted = Object.fromEntries(await request.formData());
        return { ok: true };
      },
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /request space/i }),
    );

    await waitFor(() =>
      expect(submitted).toEqual(
        expect.objectContaining({
          intent: 'requestGarageShare',
          dayId: 'day-1',
          garageBookingId: 'booking-2',
          garageOwnerUserId: 'user-2',
        }),
      ),
    );
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
