import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { AdminDataQualityPage } from './admin-data-quality';

function renderPage(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <MantineProvider theme={theme}>{ui}</MantineProvider>
    </MemoryRouter>,
  );
}

describe('AdminDataQualityPage', () => {
  it('renders data-quality issues for admins', () => {
    renderPage(
      <AdminDataQualityPage
        refreshedAt="2026-04-27T12:00:00.000Z"
        dayCount={2}
        issueCount={1}
        issues={[
          {
            type: 'unknown_circuit',
            severity: 'warning',
            dayId: 'day-1',
            date: '2026-05-10',
            circuit: 'Example Circuit',
            provider: 'Unknown Provider',
            description: 'Open pit lane',
            message: 'Circuit is not in the canonical circuit catalog.',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Data quality' }),
    ).toBeInTheDocument();
    expect(screen.getByText('unknown circuit')).toBeInTheDocument();
    expect(screen.getByText('Example Circuit')).toBeInTheDocument();
    expect(
      screen.getByText('Circuit is not in the canonical circuit catalog.'),
    ).toBeInTheDocument();
  });
});
