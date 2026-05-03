import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminExportPage } from './admin-export';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/export',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/export']} />);
}

describe('AdminExportPage', () => {
  it('shows export counts and a JSON download link', () => {
    renderWithProviders(
      <AdminExportPage
        summary={{
          exportedAt: '2026-04-27T10:00:00.000Z',
          memberCount: 3,
          inviteCount: 1,
          bookingCount: 8,
          manualDayCount: 2,
          sharedPlanCount: 4,
          seriesSubscriptionCount: 5,
          calendarFeedCount: 2,
          availableDayCount: 24,
          circuitAliasCount: 1,
          dayMergeCount: 2,
          externalNotificationCount: 3,
          feedbackCount: 1,
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Data export' }),
    ).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Calendar feeds')).toBeInTheDocument();
    expect(screen.getByText('Circuit aliases')).toBeInTheDocument();
    expect(screen.getByText('Day merges')).toBeInTheDocument();
    expect(screen.getByText('External notifications')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(
      screen.getByText(/Calendar feed tokens are redacted/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /download json/i }),
    ).toHaveAttribute('href', '/dashboard/admin/export?download=json');
  });
});
