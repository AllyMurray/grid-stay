import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminMembersPage } from './admin-members';

const members = [
  {
    id: 'user-1',
    email: 'ally@example.com',
    name: 'Ally Murray',
    picture: 'https://example.com/ally.png',
    role: 'owner' as const,
    activeTripsCount: 2,
    sharedStayCount: 1,
    nextTrip: {
      date: '2026-05-03',
      circuit: 'Silverstone',
      provider: 'MSV',
      accommodationName: 'Trackside Hotel',
    },
  },
  {
    id: 'user-2',
    email: 'driver@example.com',
    name: 'Driver Two',
    role: 'member' as const,
    activeTripsCount: 0,
    sharedStayCount: 0,
    nextTrip: undefined,
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
}

describe('AdminMembersPage', () => {
  it('renders searchable member-management rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminMembersPage members={members} />);

    expect(
      screen.getByRole('heading', { name: 'Member management' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ally Murray')).toBeInTheDocument();
    expect(screen.getByText('ally@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ally murray/i })).toHaveAttribute(
      'href',
      '/dashboard/admin/members/user-1',
    );

    await user.type(screen.getByLabelText(/search members/i), 'driver@');

    expect(screen.queryByText('Ally Murray')).not.toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
  });
});
