import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { DaysIndexData } from '~/lib/days/dashboard-feed.server';
import { theme } from '~/theme';
import { AvailableDaysPage } from './days';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

const defaultData: DaysIndexData = {
  filterKey: '',
  offset: 0,
  totalCount: 1,
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
  attendanceSummaries: {
    'day-1': {
      attendeeCount: 2,
      accommodationNames: ['Trackside Hotel'],
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
  ],
};

describe('AvailableDaysPage', () => {
  it('renders the live schedule from props', () => {
    renderWithProviders(<AvailableDaysPage data={defaultData} />);

    expect(
      screen.getByRole('heading', { name: 'Available Days' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Silverstone').length).toBeGreaterThan(0);
    expect(screen.getByText('2 attending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add to my bookings/i }),
    ).toBeVisible();
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
