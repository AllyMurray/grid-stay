import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import { theme } from '~/theme';
import { MemberDateLeaderboardPage } from './member-date-leaderboard';

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
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
}

describe('MemberDateLeaderboardPage', () => {
  it('renders the most dates leaderboard with totals and member links', () => {
    renderWithProviders(<MemberDateLeaderboardPage leaderboard={leaderboard} />);

    expect(screen.getByRole('heading', { name: 'Most dates' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to members' })).toHaveAttribute(
      'href',
      '/dashboard/members',
    );
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
    renderWithProviders(<MemberDateLeaderboardPage leaderboard={[]} />);

    expect(
      screen.getByText('No confirmed race, test, or track days have been booked yet.'),
    ).toBeInTheDocument();
  });
});
