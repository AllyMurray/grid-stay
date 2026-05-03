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
        name: 'Add missing events',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Latest')).toHaveLength(1);
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
      screen.getByRole('link', { name: /open schedule/i }),
    ).toHaveAttribute('href', '/dashboard/schedule');
    expect(screen.getByRole('link', { name: /open members/i })).toHaveAttribute(
      'href',
      '/dashboard/members',
    );
  });
});
