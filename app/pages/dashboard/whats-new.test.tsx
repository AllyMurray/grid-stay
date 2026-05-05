import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { whatsNewEntries } from '~/lib/whats-new';
import { theme } from '~/theme';
import { WhatsNewPage } from './whats-new';

function renderWhatsNewPage() {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>
        <WhatsNewPage entries={whatsNewEntries} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

describe('WhatsNewPage', () => {
  it('renders recent product updates with links back into the app', () => {
    renderWhatsNewPage();

    expect(
      screen.getByRole('heading', { name: "What's new" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Group Calendar shows attendee initials',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/booked and maybe summaries show member initials/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /open group calendar/i })[0],
    ).toHaveAttribute('href', '/dashboard/group-calendar');
    expect(
      screen.getByRole('heading', {
        name: 'Schedule views moved into My Bookings',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/calendar view stays available/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /open my bookings/i })[0],
    ).toHaveAttribute('href', '/dashboard/bookings');
    expect(
      screen.getByRole('heading', {
        name: 'Group calendar for shared plans',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/month cells show circuit and layout names/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /open group calendar/i })[1],
    ).toHaveAttribute('href', '/dashboard/group-calendar');
    expect(
      screen.getByRole('heading', {
        name: 'Planner now shows same-day options',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Latest')).toHaveLength(1);
    expect(
      screen.getByText(/other same-date events appear/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /open planner/i })[0],
    ).toHaveAttribute('href', '/dashboard/days?view=planner');
    expect(
      screen.getByRole('heading', {
        name: 'Available Days now starts with upcoming dates',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/show past dates filter/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open upcoming dates/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(
      screen.getByRole('heading', {
        name: 'Calendar and journey planner for Available Days',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/build a journey plan between matching days/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Add missing events',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/saved events appear/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add an event/i })).toHaveAttribute(
      'href',
      '/dashboard/days',
    );
    expect(
      screen.getByRole('heading', {
        name: 'Split shared event costs',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/save a payment link in account/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open cost splitting/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(
      screen.getByRole('heading', {
        name: 'Garage sharing is now built in',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/see open garage spaces/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open available days/i }),
    ).toHaveAttribute('href', '/dashboard/days');
    expect(
      screen.getByRole('heading', {
        name: 'Feedback updates are easier to track',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/email updates link back/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open feedback/i }),
    ).toHaveAttribute('href', '/dashboard/feedback');
    expect(
      screen.getByRole('heading', {
        name: 'My Bookings starts with what is ahead',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open schedule/i })).toBeNull();
    expect(screen.getByRole('link', { name: /open members/i })).toHaveAttribute(
      'href',
      '/dashboard/members',
    );
  });
});
