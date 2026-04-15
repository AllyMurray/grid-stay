import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DaysIndexData } from '~/lib/days/dashboard-feed.server';
import { theme } from '~/theme';
import { AvailableDaysPage } from './days';

function renderWithProviders(
  ui: React.ReactElement,
  initialEntry = '/dashboard/days',
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/days',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
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
  errors: [],
  filters: {
    month: '',
    circuit: '',
    provider: '',
    type: '',
  },
  monthOptions: ['2026-05'],
  circuitOptions: ['Silverstone'],
  providerOptions: ['MSV'],
  myBookingsByDay: {},
  selectedDay: null,
  selectedDaySummary: null,
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
    },
  ],
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
      screen.queryByRole('button', { name: /add to my bookings/i }),
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
    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('shows the selected-day detail when the url selects a day', () => {
    renderWithProviders(
      <AvailableDaysPage data={defaultData} />,
      '/dashboard/days?day=day-2',
    );

    expect(
      screen.getByRole('link', { name: /back to available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(screen.getAllByText('Brands Hatch').length).toBeGreaterThan(0);
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
