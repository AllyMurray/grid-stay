import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
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
        name: /keep the whole paddock on one plan/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/motorsport weekends without the group chat mess/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/current coverage: caterham-run race series only/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /sign in with google/i }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: /sign in with google/i }),
    ).toHaveAttribute('href', '/auth/login');
  });
});
