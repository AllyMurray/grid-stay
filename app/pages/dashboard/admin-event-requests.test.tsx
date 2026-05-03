import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ActionFunctionArgs, createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { EventRequestRecord } from '~/lib/db/entities/event-request.server';
import { theme } from '~/theme';
import { AdminEventRequestsPage } from './admin-event-requests';

function createRequest(
  overrides: Partial<EventRequestRecord> = {},
): EventRequestRecord {
  return {
    requestId: 'request-1',
    requestScope: 'event-request',
    status: 'pending',
    date: '2026-05-10',
    type: 'road_drive',
    title: 'Sunday road drive',
    location: 'North Coast 500',
    provider: 'Caterham and Lotus 7 Club',
    description: 'A group road drive for nearby members.',
    bookingUrl: 'https://example.com/drive',
    submittedByUserId: 'user-1',
    submittedByName: 'Driver One',
    submittedByEmail: 'driver@example.com',
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
    ...overrides,
  } as EventRequestRecord;
}

function renderWithProviders(
  eventRequests: EventRequestRecord[],
  action: (args: ActionFunctionArgs) => Promise<unknown> = async () => null,
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/event-requests',
      action,
      Component: () => (
        <MantineProvider theme={theme}>
          <AdminEventRequestsPage eventRequests={eventRequests} />
        </MantineProvider>
      ),
    },
    {
      path: '/dashboard/days',
      Component: () => null,
    },
    {
      path: '/dashboard/admin',
      Component: () => null,
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/event-requests']} />);
}

describe('AdminEventRequestsPage', () => {
  it('renders pending requests and submits reviewed calendar details', async () => {
    const submissions: Record<string, FormDataEntryValue>[] = [];

    renderWithProviders([createRequest()], async ({ request }) => {
      submissions.push(Object.fromEntries(await request.formData()));
      return {
        ok: true,
        intent: 'approveEventRequest',
        message: 'Event request approved and added to the calendar.',
        request: createRequest({ status: 'approved' }),
        manualDay: {
          dayId: 'manual:event-request:request-1',
          manualDayId: 'event-request:request-1',
          type: 'road_drive',
        },
      };
    });

    expect(
      screen.getByRole('heading', { name: 'Event requests' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sunday road drive')).toBeInTheDocument();
    expect(screen.getByText('Road Drive')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar location')).toHaveDisplayValue(
      'North Coast 500',
    );

    fireEvent.click(
      screen.getByRole('button', { name: /approve and add to calendar/i }),
    );

    await waitFor(() =>
      expect(submissions[0]).toEqual(
        expect.objectContaining({
          intent: 'approveEventRequest',
          requestId: 'request-1',
          date: '2026-05-10',
          type: 'road_drive',
          circuit: 'North Coast 500',
          provider: 'Caterham and Lotus 7 Club',
          bookingUrl: 'https://example.com/drive',
        }),
      ),
    );
  });

  it('shows reviewed requests with a link to the approved calendar day', () => {
    renderWithProviders([
      createRequest({
        status: 'approved',
        approvedDayId: 'manual:event-request:request-1',
        approvedManualDayId: 'event-request:request-1',
        reviewedByName: 'Admin One',
        reviewedAt: '2026-05-03T11:00:00.000Z',
      }),
    ]);

    expect(screen.getByText('Reviewed requests')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open calendar day' }),
    ).toHaveAttribute(
      'href',
      '/dashboard/days?day=manual%3Aevent-request%3Arequest-1',
    );
  });
});
