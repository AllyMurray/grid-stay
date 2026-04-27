import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ManualDayRecord } from '~/lib/db/entities/manual-day.server';
import { theme } from '~/theme';
import { ManualDaysPage } from './manual-days';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/manual-days',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/dashboard/days',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/manual-days']} />);
}

const manualDays: ManualDayRecord[] = [
  {
    ownerUserId: 'user-1',
    visibilityScope: 'global',
    manualDayId: 'manual-1',
    dayId: 'manual:1',
    date: '2026-03-14',
    type: 'track_day',
    circuit: 'Donington Park',
    provider: 'Caterham Motorsport',
    series: 'Caterham 270R',
    description: 'Pre-season track day',
    bookingUrl: 'https://example.com/donington',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
  {
    ownerUserId: 'user-1',
    visibilityScope: 'global',
    manualDayId: 'manual-2',
    dayId: 'manual:2',
    date: '2026-03-28',
    type: 'test_day',
    circuit: 'Silverstone',
    provider: 'Caterham Motorsport',
    description: 'Official test day',
    bookingUrl: undefined,
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-01-12T08:00:00.000Z',
  },
];

describe('ManualDaysPage', () => {
  it('renders the add form and grouped manual-day list', () => {
    renderWithProviders(
      <ManualDaysPage
        manualDays={manualDays}
        sourceErrors={[]}
        refreshedAt="2026-04-15T10:30:00.000Z"
        circuitOptions={['Donington Park', 'Silverstone']}
        providerOptions={['Caterham Motorsport', 'MSV Trackdays']}
        seriesOptions={['Caterham 270R']}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Manual Days' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Add a manual day' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Manually added days' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Feed source status' }),
    ).toBeInTheDocument();
    expect(screen.getByText('March 2026')).toBeInTheDocument();
    expect(screen.getAllByText('Donington Park').length).toBeGreaterThan(0);
    expect(screen.getByText('Series • Caterham 270R')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Provider site' })).toHaveAttribute(
      'href',
      'https://example.com/donington',
    );
    expect(
      screen.getAllByRole('link', { name: 'Open in available days' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('combobox', { name: 'Circuit' }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Start typing a circuit'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Provider' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Series' }),
    ).toBeInTheDocument();
  });

  it('shows the empty state when no manual days exist', () => {
    renderWithProviders(
      <ManualDaysPage
        manualDays={[]}
        sourceErrors={[]}
        refreshedAt=""
        circuitOptions={['Donington Park']}
        providerOptions={['Caterham Motorsport']}
        seriesOptions={[]}
      />,
    );

    expect(screen.getByText('No manual days yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add the first extra Caterham date here and it will appear in Available Days for everyone.',
      ),
    ).toBeInTheDocument();
  });

  it('shows source loading errors only on the admin page', () => {
    renderWithProviders(
      <ManualDaysPage
        manualDays={[]}
        sourceErrors={[
          {
            source: 'broken-testing',
            message: 'Timed out loading feed',
          },
        ]}
        refreshedAt="2026-04-15T10:30:00.000Z"
        circuitOptions={['Donington Park']}
        providerOptions={['Caterham Motorsport']}
        seriesOptions={[]}
      />,
    );

    expect(
      screen.getByText('Some sources could not be loaded.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('broken-testing: Timed out loading feed'),
    ).toBeInTheDocument();
  });
});
