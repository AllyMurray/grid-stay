import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminDashboardPage } from './admin-dashboard';

function renderAdminDashboardPage() {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>
        <AdminDashboardPage />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('AdminDashboardPage', () => {
  it('groups every admin tool into a single mobile-first hub', () => {
    renderAdminDashboardPage();

    expect(
      screen.getByRole('heading', { name: 'Admin dashboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Run the site' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Manage calendar data' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Members and records' }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: 'Open Feed status' }),
    ).toHaveAttribute('href', '/dashboard/admin/feed');
    expect(
      screen.getByRole('link', { name: 'Open Manual days' }),
    ).toHaveAttribute('href', '/dashboard/manual-days');
    expect(
      screen.getByRole('link', { name: 'Open Event requests' }),
    ).toHaveAttribute('href', '/dashboard/admin/event-requests');
    expect(
      screen.getByRole('link', { name: 'Open Circuit tools' }),
    ).toHaveAttribute('href', '/dashboard/admin/circuits');
    expect(
      screen.getByRole('link', { name: 'Open Day merges' }),
    ).toHaveAttribute('href', '/dashboard/admin/day-merges');
    expect(
      screen.getByRole('link', { name: 'Open Data quality' }),
    ).toHaveAttribute('href', '/dashboard/admin/data-quality');
    expect(
      screen.getByRole('link', { name: 'Open Operations' }),
    ).toHaveAttribute('href', '/dashboard/admin/operations');
    expect(
      screen.getByRole('link', { name: 'Open Member management' }),
    ).toHaveAttribute('href', '/dashboard/admin/members');
    expect(
      screen.getByRole('link', { name: 'Open Data export' }),
    ).toHaveAttribute('href', '/dashboard/admin/export');
    expect(screen.getByRole('link', { name: 'Open Feedback' })).toHaveAttribute(
      'href',
      '/dashboard/admin/feedback',
    );
  });
});
