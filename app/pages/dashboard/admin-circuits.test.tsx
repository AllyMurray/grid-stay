import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminCircuitsPage } from './admin-circuits';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/circuits',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/circuits']} />);
}

describe('AdminCircuitsPage', () => {
  it('shows aliases and current circuit labels', () => {
    renderWithProviders(
      <AdminCircuitsPage
        unknownCircuitCount={0}
        aliases={[
          {
            aliasKey: 'sntterton-300',
            aliasScope: 'circuit-alias',
            rawCircuit: 'Sntterton 300',
            canonicalCircuit: 'Snetterton',
            canonicalLayout: '300',
            note: 'Caterham import alias',
            createdByUserId: 'admin-1',
            createdAt: '2026-04-27T10:00:00.000Z',
            updatedAt: '2026-04-27T10:00:00.000Z',
          },
        ]}
        circuits={[
          {
            circuit: 'Snetterton',
            layout: '300',
            circuitKnown: true,
            dayCount: 3,
            providers: ['Caterham Motorsport'],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Circuit tools' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sntterton 300')).toBeInTheDocument();
    expect(screen.getByText(/Maps to Snetterton 300/)).toBeInTheDocument();
    expect(screen.getByText('Caterham Motorsport')).toBeInTheDocument();
  });
});
