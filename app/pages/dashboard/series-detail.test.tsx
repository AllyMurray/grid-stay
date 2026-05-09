import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import { theme } from '~/theme';
import { RaceSeriesDetailPage } from './series-detail';

function renderPage(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub />);
}

describe('RaceSeriesDetailPage', () => {
  it('renders linked series rounds and filter actions', () => {
    renderPage(
      <RaceSeriesDetailPage
        seriesKey="caterham-academy"
        seriesName="Caterham Academy"
        roundCount={2}
        bookedCount={1}
        maybeCount={0}
        missingCount={1}
        cancelledCount={0}
        manualRoundCount={1}
        subscriptionStatus="maybe"
        rounds={[
          {
            dayId: 'manual-test',
            date: '2026-05-10',
            type: 'test_day',
            circuit: 'Snetterton',
            layout: '300',
            provider: 'Caterham Motorsport',
            description: 'Official test day',
            myBookingStatus: 'booked',
            isManual: true,
          },
          {
            dayId: 'race-1',
            date: '2026-06-10',
            type: 'race_day',
            circuit: 'Brands Hatch',
            provider: 'Caterham Motorsport',
            description: 'Round 1',
            isManual: false,
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Caterham Academy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In My Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add missing dates as maybe' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Remove series' })).toBeVisible();
    expect(screen.getByText('Snetterton 300')).toBeInTheDocument();
    expect(screen.getByText('Official test day')).toBeInTheDocument();
    expect(screen.getByText('Not added')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open filtered days' })).toHaveAttribute(
      'href',
      '/dashboard/days?series=caterham-academy',
    );
  });

  it('renders the add-series CTA when the member is not subscribed', () => {
    renderPage(
      <RaceSeriesDetailPage
        seriesKey="caterham-academy"
        seriesName="Caterham Academy"
        roundCount={1}
        bookedCount={0}
        maybeCount={0}
        missingCount={1}
        cancelledCount={0}
        manualRoundCount={0}
        rounds={[
          {
            dayId: 'race-1',
            date: '2026-06-10',
            type: 'race_day',
            circuit: 'Brands Hatch',
            provider: 'Caterham Motorsport',
            description: 'Round 1',
            isManual: false,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Add this series to My Bookings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add missing dates as booked' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Remove series' })).not.toBeInTheDocument();
  });
});
