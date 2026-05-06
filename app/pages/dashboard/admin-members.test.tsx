import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
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
      accommodationStatus: 'booked' as const,
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

const joinLinks = [
  {
    tokenHash: 'hash-1',
    tokenHint: 'ABCDEFGH',
    mode: 'usage_limit' as const,
    maxUses: 5,
    acceptedCount: 2,
    state: 'active' as const,
    createdByName: 'Admin One',
    expiresAt: '2026-05-05T10:00:00.000Z',
    createdAt: '2026-05-04T10:00:00.000Z',
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      action: async () => null,
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/']} />);
}

describe('AdminMembersPage', () => {
  it('renders searchable member-management rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminMembersPage members={members} joinLinks={joinLinks} />);

    expect(screen.getByRole('heading', { name: 'Member management' })).toBeInTheDocument();
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

  it('renders join-link controls and usage-limit mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminMembersPage members={members} joinLinks={joinLinks} />);

    expect(screen.getByText('Join links')).toBeInTheDocument();
    expect(screen.getByText(/2 of 5 joined/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: /link mode/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Usage limit', hidden: true }));

    expect(screen.getByLabelText('Usage limit')).toBeInTheDocument();
  });
});
