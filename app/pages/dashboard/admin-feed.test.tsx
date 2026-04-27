import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
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
        dayCount={24}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Feed status' }),
    ).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(
      screen.getByText('Some sources could not be loaded.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('broken-testing: Timed out loading feed'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open available days' }),
    ).toHaveAttribute('href', '/dashboard/days');
  });

  it('shows a healthy source state when no errors were reported', () => {
    renderWithProviders(
      <AdminFeedPage
        sourceErrors={[]}
        refreshedAt="2026-04-15T10:30:00.000Z"
        dayCount={24}
      />,
    );

    expect(
      screen.getByText(
        'No source loading errors were reported in the latest snapshot.',
      ),
    ).toBeInTheDocument();
  });
});
