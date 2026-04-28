import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { MembersPage } from './members';

const members = [
  {
    id: 'user-1',
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
    name: 'Driver Two',
    role: 'member' as const,
    activeTripsCount: 0,
    sharedStayCount: 0,
    nextTrip: undefined,
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

describe('MembersPage', () => {
  it('renders the member directory from props', () => {
    renderWithProviders(<MembersPage members={members} pendingInvites={[]} />);

    expect(
      screen.getByRole('heading', { name: 'Site members' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ally Murray')).toBeInTheDocument();
    expect(screen.getByText(/Silverstone/)).toBeInTheDocument();
    expect(screen.getByText(/trackside hotel/i)).toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
    expect(screen.getByText('No upcoming trips yet')).toBeInTheDocument();
    expect(screen.queryByText('owner')).not.toBeInTheDocument();
    expect(screen.queryByText('member')).not.toBeInTheDocument();
  });

  it('filters the directory by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembersPage members={members} pendingInvites={[]} />);

    await user.type(screen.getByLabelText(/search members/i), 'silverstone');

    expect(screen.getByText('Ally Murray')).toBeInTheDocument();
    expect(screen.queryByText('Driver Two')).not.toBeInTheDocument();
  });

  it('shows pending invite expiry and controls', () => {
    renderWithProviders(
      <MembersPage
        members={members}
        pendingInvites={[
          {
            inviteEmail: 'new.driver@example.com',
            invitedByName: 'Ally Murray',
            status: 'pending',
            expiresAt: '2026-05-28T10:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('new.driver@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Expires 28 May/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });
});
