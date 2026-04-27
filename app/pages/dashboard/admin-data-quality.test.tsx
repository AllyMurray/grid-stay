import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminDataQualityPage } from './admin-data-quality';

function renderPage(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/data-quality',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
      action: () => ({ ok: true }),
    },
    {
      path: '/dashboard/admin/feed',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/data-quality']} />);
}

describe('AdminDataQualityPage', () => {
  it('renders data-quality issues for admins', () => {
    renderPage(
      <AdminDataQualityPage
        refreshedAt="2026-04-27T12:00:00.000Z"
        dayCount={2}
        issueCount={1}
        openIssueCount={1}
        ignoredIssueCount={0}
        resolvedIssueCount={0}
        issues={[
          {
            issueId: 'unknown_circuit:day-1',
            type: 'unknown_circuit',
            severity: 'warning',
            status: 'open',
            dayId: 'day-1',
            date: '2026-05-10',
            circuit: 'Example Circuit',
            provider: 'Unknown Provider',
            description: 'Open pit lane',
            message: 'Circuit is not in the canonical circuit catalog.',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Data quality' }),
    ).toBeInTheDocument();
    expect(screen.getByText('unknown circuit')).toBeInTheDocument();
    expect(screen.getByText('Example Circuit')).toBeInTheDocument();
    expect(
      screen.getByText('Circuit is not in the canonical circuit catalog.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ignore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('renders ignored issue state with a reopen action', () => {
    renderPage(
      <AdminDataQualityPage
        refreshedAt="2026-04-27T12:00:00.000Z"
        dayCount={2}
        issueCount={0}
        openIssueCount={0}
        ignoredIssueCount={1}
        resolvedIssueCount={0}
        issues={[
          {
            issueId: 'unknown_circuit:day-1',
            type: 'unknown_circuit',
            severity: 'warning',
            status: 'ignored',
            dayId: 'day-1',
            date: '2026-05-10',
            circuit: 'Example Circuit',
            provider: 'Unknown Provider',
            description: 'Open pit lane',
            message: 'Circuit is not in the canonical circuit catalog.',
            stateNote: 'Known source issue',
          },
        ]}
      />,
    );

    expect(screen.getByText('ignored')).toBeInTheDocument();
    expect(screen.getByText('Known source issue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
  });
});
