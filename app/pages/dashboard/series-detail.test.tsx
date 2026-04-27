import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { RaceSeriesDetailPage } from './series-detail';

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
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
        manualRoundCount={1}
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

    expect(
      screen.getByRole('heading', { name: 'Caterham Academy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Snetterton 300')).toBeInTheDocument();
    expect(screen.getByText('Official test day')).toBeInTheDocument();
    expect(screen.getByText('Not added')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open filtered days' }),
    ).toHaveAttribute('href', '/dashboard/days?series=caterham-academy');
  });
});
