import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { MemberDaysPage, type MemberDaysPageProps } from './member-days';

const baseProps: MemberDaysPageProps = {
  member: {
    id: 'user-1',
    name: 'Ally Murray',
    image: 'https://example.com/ally.png',
    role: 'member',
  },
  days: [
    {
      dayId: 'day-1',
      date: '2026-05-03',
      type: 'race_day',
      status: 'booked',
      circuit: 'Silverstone',
      layout: 'GP',
      provider: 'MSV',
      description: 'GT weekend',
      arrivalDateTime: '2026-05-02 20:00:00',
      accommodationStatus: 'booked',
      accommodationName: 'Trackside Hotel',
    },
    {
      dayId: 'day-2',
      date: '2026-05-05',
      type: 'track_day',
      status: 'maybe',
      circuit: 'Donington Park',
      provider: 'MSV Car Trackdays',
      description: 'Track evening',
      accommodationStatus: 'not_required',
    },
  ],
  myBookingsByDay: {
    'day-2': {
      bookingId: 'day-2',
      status: 'maybe',
    },
  },
};

function renderMemberDaysPage(props: MemberDaysPageProps = baseProps) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/members/:memberId',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <MemberDaysPage {...props} />
        </MantineProvider>
      ),
    },
    {
      path: '/dashboard/members',
      Component: () => null,
    },
    {
      path: '/dashboard/bookings',
      Component: () => null,
    },
    {
      path: '/dashboard/days',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/members/user-1']} />);
}

describe('MemberDaysPage', () => {
  it('renders public member days with booking actions', () => {
    renderMemberDaysPage();

    expect(
      screen.getByRole('heading', { name: "Ally Murray's days" }),
    ).toBeInTheDocument();
    expect(screen.getByText('Silverstone GP')).toBeInTheDocument();
    expect(screen.getByText(/Sun, 3 May 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Race day/)).toBeInTheDocument();
    expect(
      screen.getByText('Accommodation: Trackside Hotel'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Accommodation: No hotel needed'),
    ).toBeInTheDocument();
    expect(screen.getByText('Arrival: Sat 2 May, 20:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add as maybe' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add as booked' })).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open my booking' }),
    ).toHaveAttribute('href', '/dashboard/bookings');
    expect(
      screen.getAllByRole('link', { name: 'View day' })[0],
    ).toHaveAttribute('href', '/dashboard/days?day=day-1');
  });

  it('does not render private booking fields', () => {
    renderMemberDaysPage();

    expect(screen.queryByText('REF-123')).not.toBeInTheDocument();
    expect(screen.queryByText('HOTEL-7')).not.toBeInTheDocument();
    expect(screen.queryByText('Quiet room')).not.toBeInTheDocument();
  });

  it('renders an empty state when the member has no upcoming days', () => {
    renderMemberDaysPage({
      member: baseProps.member,
      days: [],
      myBookingsByDay: {},
    });

    expect(screen.getByText('No upcoming shared days')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This member does not have any upcoming booked or maybe days yet.',
      ),
    ).toBeInTheDocument();
  });
});
