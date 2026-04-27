import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminOperationsPage } from './admin-operations';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/operations',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/operations']} />);
}

describe('AdminOperationsPage', () => {
  it('shows recent audit and error events', () => {
    renderWithProviders(
      <AdminOperationsPage
        errorCount={1}
        warningCount={0}
        lastErrorAt="2026-04-27T10:30:00.000Z"
        events={[
          {
            eventId: 'event-1',
            eventScope: 'app',
            category: 'error',
            severity: 'error',
            action: 'availableDays.notifications.failed',
            message: 'Failed to create available day notifications.',
            actorUserId: undefined,
            actorName: undefined,
            subjectType: 'availableDays',
            subjectId: 'refresh',
            createdAt: '2026-04-27T10:30:00.000Z',
          },
          {
            eventId: 'event-2',
            eventScope: 'app',
            category: 'audit',
            severity: 'info',
            action: 'member.invite.created',
            message: 'Member invite created.',
            actorUserId: 'admin-1',
            actorName: 'Admin One',
            subjectType: 'memberInvite',
            subjectId: 'driver@example.com',
            createdAt: '2026-04-27T10:00:00.000Z',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Operations' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Failed to create available day notifications.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Member invite created.')).toBeInTheDocument();
    expect(screen.getByText('Admin One')).toBeInTheDocument();
  });
});
