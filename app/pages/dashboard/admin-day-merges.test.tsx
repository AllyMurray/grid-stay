import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import { theme } from '~/theme';
import { AdminDayMergesPage } from './admin-day-merges';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/day-merges',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/day-merges']} />);
}

describe('AdminDayMergesPage', () => {
  it('shows merge rules and day options', () => {
    renderWithProviders(
      <AdminDayMergesPage
        days={[
          {
            dayId: 'source-day',
            label: '2026-05-10 • Snetterton • Caterham Motorsport • Duplicate',
            date: '2026-05-10',
            circuit: 'Snetterton',
            provider: 'Caterham Motorsport',
          },
          {
            dayId: 'target-day',
            label: '2026-05-10 • Snetterton • Caterham Motorsport • Canonical',
            date: '2026-05-10',
            circuit: 'Snetterton',
            provider: 'Caterham Motorsport',
          },
        ]}
        merges={[
          {
            sourceDayId: 'source-day',
            targetDayId: 'target-day',
            sourceLabel: '2026-05-10 • Snetterton • Caterham Motorsport • Duplicate',
            targetLabel: '2026-05-10 • Snetterton • Caterham Motorsport • Canonical',
            mergeScope: 'day-merge',
            reason: 'Duplicate Caterham import',
            createdByUserId: 'admin-1',
            createdAt: '2026-04-27T10:00:00.000Z',
            updatedAt: '2026-04-27T10:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Day merge rules' })).toBeInTheDocument();
    expect(screen.getByText(/Duplicate Caterham import/)).toBeInTheDocument();
    expect(screen.getByText(/Keeps 2026-05-10/)).toBeInTheDocument();
  });
});
