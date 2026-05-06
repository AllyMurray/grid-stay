import { MantineProvider } from '@mantine/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import type { GroupCalendarData } from '~/lib/auth/members.server';
import { theme } from '~/theme';
import { GroupCalendarPage } from './group-calendar';

const groupCalendarData: GroupCalendarData = {
  today: '2026-05-01',
  month: '2026-05',
  members: [
    {
      id: 'user-1',
      name: 'Ally Murray',
      role: 'owner',
      picture: 'https://example.com/ally.png',
    },
    {
      id: 'user-2',
      name: 'Driver Two',
      role: 'member',
    },
    {
      id: 'user-3',
      name: 'Tim George',
      role: 'member',
    },
  ],
  events: [
    {
      dayId: 'day-1',
      date: '2026-05-07',
      type: 'track_day',
      circuit: 'Knockhill',
      provider: 'Hot Hatch Trackday Sessions',
      description: 'Full Day',
      bookedCount: 1,
      maybeCount: 1,
      attendees: [
        {
          userId: 'user-1',
          userName: 'Ally Murray',
          userImage: 'https://example.com/ally.png',
          status: 'booked',
          accommodationStatus: 'unknown',
        },
        {
          userId: 'user-2',
          userName: 'Driver Two',
          status: 'maybe',
          accommodationStatus: 'not_required',
        },
      ],
    },
    {
      dayId: 'day-2',
      date: '2026-05-07',
      type: 'test_day',
      circuit: 'Oulton Park',
      layout: 'International',
      provider: 'MSV Testing',
      description: 'Open pit lane',
      bookedCount: 0,
      maybeCount: 1,
      attendees: [
        {
          userId: 'user-3',
          userName: 'Tim George',
          status: 'maybe',
          accommodationStatus: 'looking',
        },
      ],
    },
    {
      dayId: 'day-3',
      date: '2026-06-02',
      type: 'race_day',
      circuit: 'Silverstone',
      provider: 'Caterham Motorsport',
      description: 'Race weekend',
      bookedCount: 1,
      maybeCount: 0,
      attendees: [
        {
          userId: 'user-1',
          userName: 'Ally Murray',
          status: 'booked',
          accommodationStatus: 'booked',
          accommodationName: 'Trackside Hotel',
        },
      ],
    },
  ],
};

function renderGroupCalendar(data: GroupCalendarData = groupCalendarData) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>
        <GroupCalendarPage {...data} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('GroupCalendarPage', () => {
  it('renders a month calendar and opens the selected day roster', async () => {
    const user = userEvent.setup();
    renderGroupCalendar();

    expect(screen.getByRole('heading', { name: 'Group Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeInTheDocument();

    const dayButton = screen.getByRole('button', {
      name: /Thu, 7 May 2026: 2 events, 1 booked, 2 maybe/i,
    });
    expect(within(dayButton).getByText('Knockhill')).toBeInTheDocument();
    expect(within(dayButton).getByText('Oulton Park International')).toBeInTheDocument();
    expect(within(dayButton).getByRole('img', { name: /booked: ally murray/i })).toHaveTextContent(
      'AM',
    );
    expect(
      within(dayButton).getByRole('img', {
        name: /maybe: driver two, tim george/i,
      }),
    ).toHaveTextContent('DTTG');
    await user.click(dayButton);

    const drawer = await screen.findByRole('dialog', {
      name: /Thu, 7 May 2026/i,
    });

    expect(within(drawer).getByRole('heading', { name: 'Knockhill' })).toBeInTheDocument();
    expect(
      within(drawer).getByRole('heading', {
        name: 'Oulton Park International',
      }),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Ally Murray')).toBeInTheDocument();
    expect(within(drawer).getByText('Driver Two')).toBeInTheDocument();
    expect(within(drawer).getByText('Tim George')).toBeInTheDocument();
    expect(within(drawer).getAllByRole('link', { name: 'Open day' })[0]).toHaveAttribute(
      'href',
      '/dashboard/days?day=day-1',
    );
  });

  it('shows the full member name when hovering over calendar initials', async () => {
    const user = userEvent.setup();
    renderGroupCalendar();

    const dayButton = screen.getByRole('button', {
      name: /Thu, 7 May 2026: 2 events, 1 booked, 2 maybe/i,
    });

    await user.hover(within(dayButton).getByText('AM'));

    expect(await screen.findByText('Ally Murray')).toBeInTheDocument();
  });

  it('filters the calendar by status', async () => {
    const user = userEvent.setup();
    renderGroupCalendar();

    await user.click(screen.getByRole('checkbox', { name: 'Maybe' }));

    expect(
      screen.getByRole('button', {
        name: /Thu, 7 May 2026: 1 event, 1 booked, 0 maybe/i,
      }),
    ).toBeInTheDocument();
  });

  it('can show selected members only', async () => {
    const user = userEvent.setup();
    renderGroupCalendar();

    const peopleInput = screen.getByRole('combobox', { name: /show people/i });
    await user.type(peopleInput, 'Ally{ArrowDown}{Enter}');

    expect(
      screen.getByRole('button', {
        name: /Thu, 7 May 2026: 1 event, 1 booked, 0 maybe/i,
      }),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no members have shared plans', () => {
    renderGroupCalendar({
      today: '2026-05-01',
      month: '2026-05',
      members: groupCalendarData.members,
      events: [],
    });

    expect(screen.getByText(/no group plans yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse available days/i })).toHaveAttribute(
      'href',
      '/dashboard/days',
    );
  });
});
