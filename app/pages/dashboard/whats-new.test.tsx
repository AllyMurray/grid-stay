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
        name: 'Schedule starts with what is ahead',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Latest')).toHaveLength(1);
    expect(
      screen.getByText(/past and cancelled trips stay available/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open schedule/i }),
    ).toHaveAttribute('href', '/dashboard/schedule');
    expect(screen.getByRole('link', { name: /open members/i })).toHaveAttribute(
      'href',
      '/dashboard/members',
    );
  });
});
