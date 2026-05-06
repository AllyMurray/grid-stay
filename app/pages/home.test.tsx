import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import { theme } from '~/theme';
import { HomePage } from './home';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  it('shows the current calendar coverage before sign in', () => {
    renderWithProviders(<HomePage hasSession={false} />);

    expect(
      screen.getByRole('heading', {
        name: /leave the date chasing, booking screenshots, and hotel guesswork behind/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/motorsport weekends without the group chat mess/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/current coverage: caterham-run race series only/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in with google/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/auth/login');
  });
});
