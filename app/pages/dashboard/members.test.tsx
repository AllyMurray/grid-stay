import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
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
      accommodationStatus: 'booked' as const,
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

const leaderboard = [
  {
    id: 'user-1',
    name: 'Ally Murray',
    picture: 'https://example.com/ally.png',
    totalCount: 4,
    raceDayCount: 1,
    testDayCount: 1,
    trackDayCount: 2,
  },
  {
    id: 'user-2',
    name: 'Driver Two',
    totalCount: 1,
    raceDayCount: 0,
    testDayCount: 1,
    trackDayCount: 0,
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
    renderWithProviders(<MembersPage members={members} pendingInvites={[]} leaderboard={[]} />);

    expect(screen.getByRole('heading', { name: 'Site members' })).toBeInTheDocument();
    expect(screen.getByText('Ally Murray')).toBeInTheDocument();
    expect(screen.getByText(/Silverstone/)).toBeInTheDocument();
    expect(screen.getByText(/trackside hotel/i)).toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
    expect(screen.getByText('No upcoming trips yet')).toBeInTheDocument();
    expect(screen.queryByText('2 members')).not.toBeInTheDocument();
    expect(screen.queryByText('1 with trip')).not.toBeInTheDocument();
    expect(screen.queryByText('Accommodations')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View days' })[0]).toHaveAttribute(
      'href',
      '/dashboard/members/user-1',
    );
    expect(screen.queryByText('owner')).not.toBeInTheDocument();
    expect(screen.queryByText('member')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.queryByText(/Google email/i)).not.toBeInTheDocument();
  });

  it('filters the directory by search query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MembersPage members={members} pendingInvites={[]} leaderboard={[]} />);

    await user.type(screen.getByLabelText(/search members/i), 'silverstone');

    expect(screen.getByText('Ally Murray')).toBeInTheDocument();
    expect(screen.queryByText('Driver Two')).not.toBeInTheDocument();
  });

  it('shows pending invite expiry and controls', () => {
    renderWithProviders(
      <MembersPage
        members={members}
        leaderboard={[]}
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
    expect(screen.getByText('Your pending invites')).toBeInTheDocument();
    expect(screen.getByText(/Expires 28 May/)).toBeInTheDocument();
    expect(screen.queryByText(/Invited by Ally Murray/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('renders the most dates leaderboard with totals and member links', () => {
    renderWithProviders(
      <MembersPage members={members} pendingInvites={[]} leaderboard={leaderboard} />,
    );

    expect(screen.getByText('Most dates')).toBeInTheDocument();
    expect(screen.getByText('4 dates')).toBeInTheDocument();
    expect(screen.getAllByText('Race 1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Test 1')[0]).toBeInTheDocument();
    expect(screen.getByText('Track 2')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open days' })[0]).toHaveAttribute(
      'href',
      '/dashboard/members/user-1',
    );
  });

  it('renders an empty leaderboard state', () => {
    renderWithProviders(<MembersPage members={members} pendingInvites={[]} leaderboard={[]} />);

    expect(
      screen.getByText('No confirmed race, test, or track days have been booked yet.'),
    ).toBeInTheDocument();
  });
});
