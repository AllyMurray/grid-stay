import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import { theme } from '~/theme';
import { AdminFeedPage } from './admin-feed';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/feed',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
    {
      path: '/dashboard/days',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/feed']} />);
}

describe('AdminFeedPage', () => {
  it('shows source loading errors on the dedicated admin page', () => {
    renderWithProviders(
      <AdminFeedPage
        sourceErrors={[
          {
            source: 'broken-testing',
            message: 'Timed out loading feed',
          },
        ]}
        refreshedAt="2026-04-15T10:30:00.000Z"
        dayCount={26}
        snapshotDayCount={24}
        manualDayCount={2}
        dateRange={{
          firstDate: '2026-05-01',
          lastDate: '2026-10-11',
        }}
        sourceSummaries={[
          {
            key: 'testing:focused-events',
            label: 'focused-events',
            sourceType: 'testing',
            dayCount: 24,
          },
          {
            key: 'manual:manual',
            label: 'Manual days',
            sourceType: 'manual',
            dayCount: 2,
          },
        ]}
        recentChanges={[
          {
            changeId: 'change-1',
            changeScope: 'available-days',
            refreshId: 'refresh-1',
            changeType: 'changed',
            severity: 'warning',
            dayId: 'day-1',
            date: '2026-05-10',
            dayType: 'track_day',
            circuit: 'Snetterton',
            provider: 'MSV Trackdays',
            description: 'Open pit lane',
            changedFields: ['date'],
            createdAt: '2026-04-15T10:30:00.000Z',
          },
        ]}
        health={{
          status: 'warning',
          message: 'The latest refresh completed with one or more source errors.',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Feed status' })).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('Source coverage')).toBeInTheDocument();
    expect(screen.getByText('Latest feed changes')).toBeInTheDocument();
    expect(screen.getByText('date')).toBeInTheDocument();
    expect(screen.getByText('focused-events')).toBeInTheDocument();
    expect(screen.getAllByText('Manual days').length).toBeGreaterThan(0);
    expect(screen.getByText('Some sources could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('broken-testing: Timed out loading feed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open available days' })).toHaveAttribute(
      'href',
      '/dashboard/days',
    );
  });

  it('shows a healthy source state when no errors were reported', () => {
    renderWithProviders(
      <AdminFeedPage
        sourceErrors={[]}
        refreshedAt="2026-04-15T10:30:00.000Z"
        dayCount={24}
        snapshotDayCount={24}
        manualDayCount={0}
        dateRange={{
          firstDate: '2026-05-01',
          lastDate: '2026-10-11',
        }}
        sourceSummaries={[
          {
            key: 'trackdays:msv-trackday',
            label: 'msv-trackday',
            sourceType: 'trackdays',
            dayCount: 24,
          },
        ]}
        recentChanges={[]}
        health={{
          status: 'healthy',
          message: 'The latest available-days snapshot is current and error-free.',
        }}
      />,
    );

    expect(
      screen.getByText('No source loading errors were reported in the latest snapshot.'),
    ).toBeInTheDocument();
  });
});
