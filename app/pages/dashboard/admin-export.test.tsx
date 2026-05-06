import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
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
          joinLinkCount: 1,
          bookingCount: 8,
          manualDayCount: 2,
          sharedPlanCount: 4,
          seriesSubscriptionCount: 5,
          calendarFeedCount: 2,
          availableDayCount: 24,
          circuitAliasCount: 1,
          dayMergeCount: 2,
          externalNotificationCount: 3,
          garageShareRequestCount: 1,
          feedbackCount: 1,
          costGroupCount: 2,
          costExpenseCount: 3,
          costSettlementCount: 4,
          memberPaymentPreferenceCount: 5,
          whatsNewViewCount: 2,
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Data export' })).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Join links')).toBeInTheDocument();
    expect(screen.getByText('Calendar feeds')).toBeInTheDocument();
    expect(screen.getByText('Circuit aliases')).toBeInTheDocument();
    expect(screen.getByText('Day merges')).toBeInTheDocument();
    expect(screen.getByText('External notifications')).toBeInTheDocument();
    expect(screen.getByText('Feedback')).toBeInTheDocument();
    expect(screen.getByText('Cost groups')).toBeInTheDocument();
    expect(screen.getByText('Cost expenses')).toBeInTheDocument();
    expect(screen.getByText('Cost settlements')).toBeInTheDocument();
    expect(screen.getByText('Payment preferences')).toBeInTheDocument();
    expect(screen.getByText("What's new views")).toBeInTheDocument();
    expect(screen.getByText(/Calendar feed tokens are redacted/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download json/i })).toHaveAttribute(
      'href',
      '/dashboard/admin/export?download=json',
    );
  });
});
