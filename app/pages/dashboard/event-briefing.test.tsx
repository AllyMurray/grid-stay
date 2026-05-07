import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vite-plus/test';
import type { EventBriefingData } from '~/lib/bookings/event-briefing.server';
import { theme } from '~/theme';
import { EventBriefingPage } from './event-briefing';

function renderWithProviders(ui: React.ReactElement) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => <MantineProvider theme={theme}>{ui}</MantineProvider>,
    },
  ]);

  return render(<Stub />);
}

const briefingData: EventBriefingData = {
  booking: {
    bookingId: 'booking-1',
    userId: 'user-1',
    userName: 'Driver One',
    dayId: 'day-1',
    date: '2026-05-03',
    type: 'race_day',
    status: 'booked',
    circuit: 'Silverstone',
    provider: 'MSV',
    description: 'GT weekend',
    bookingReference: 'REF-123',
    arrivalDateTime: '2026-05-02 20:00:00',
    accommodationStatus: 'booked',
    accommodationName: 'Trackside Hotel',
    accommodationReference: 'HOTEL-7',
    garageBooked: true,
    garageCapacity: 2,
    garageLabel: 'Garage 4',
    notes: 'Quiet room',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
  },
  day: {
    dayId: 'day-1',
    date: '2026-05-03',
    type: 'race_day',
    circuit: 'Silverstone',
    provider: 'MSV',
    description: 'GT weekend',
    bookingUrl: 'https://example.com/book',
    availability: 'Spaces',
  },
  attendance: {
    attendeeCount: 2,
    attendees: [
      {
        bookingId: 'booking-1',
        userId: 'user-1',
        userName: 'Driver One',
        status: 'booked',
        arrivalDateTime: '2026-05-02 20:00:00',
        accommodationStatus: 'booked',
        accommodationName: 'Trackside Hotel',
        garageBooked: true,
        garageCapacity: 2,
        garageLabel: 'Garage 4',
      },
      {
        bookingId: 'booking-2',
        userId: 'user-2',
        userName: 'Driver Two',
        status: 'maybe',
        accommodationStatus: 'booked',
        accommodationName: 'Trackside Hotel',
        notes: 'Other private note',
        bookingReference: 'OTHER-REF',
      } as never,
    ],
    accommodationNames: ['Trackside Hotel'],
    garageOwnerCount: 1,
    garageOpenSpaceCount: 1,
    garageShareOptions: [
      {
        garageBookingId: 'booking-1',
        ownerUserId: 'user-1',
        ownerName: 'Driver One',
        ownerArrivalDateTime: '2026-05-02 20:00:00',
        garageLabel: 'Garage 4',
        garageCapacity: 2,
        approvedRequestCount: 0,
        pendingRequestCount: 0,
        openSpaceCount: 1,
        requests: [],
      },
    ],
  },
  sharedPlan: {
    dayId: 'day-1',
    notes: 'Meet by garage 4.',
    dinnerVenue: 'The Paddock Arms',
    dinnerTime: '19:30',
    dinnerHeadcount: '6',
    dinnerNotes: 'Booking under Grid Stay.',
    updatedByName: 'Driver One',
    updatedAt: '2026-04-27T10:00:00.000Z',
  },
  costSummary: {
    dayId: 'day-1',
    currency: 'GBP',
    availableParticipants: [
      { userId: 'user-1', userName: 'Driver One' },
      { userId: 'user-2', userName: 'Driver Two' },
    ],
    totalPence: 10_000,
    groups: [
      {
        groupId: 'garage',
        dayId: 'day-1',
        name: 'Garage 4',
        category: 'garage',
        participants: [
          { userId: 'user-1', userName: 'Driver One' },
          { userId: 'user-2', userName: 'Driver Two' },
        ],
        totalPence: 10_000,
        currency: 'GBP',
        expenses: [],
        createdByUserId: 'user-1',
        createdByName: 'Driver One',
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
        canEdit: true,
      },
    ],
    netSettlements: [
      {
        settlementId: 'settlement-1',
        dayId: 'day-1',
        debtorUserId: 'user-1',
        debtorName: 'Driver One',
        creditorUserId: 'user-2',
        creditorName: 'Driver Two',
        amountPence: 5000,
        currency: 'GBP',
        status: 'open',
        breakdownHash: 'hash',
        breakdown: [],
        canMarkSent: true,
        canConfirmReceived: false,
      },
    ],
  },
  latestUpdates: [
    {
      notificationId: 'changed-day#1',
      type: 'changed_available_day',
      description: 'Updated fields: date',
      provider: 'MSV',
      date: '2026-05-03',
      circuit: 'Silverstone',
      createdAt: '2026-04-20T10:00:00.000Z',
      isRead: false,
    },
  ],
  readinessPrompts: [],
};

describe('EventBriefingPage', () => {
  it('renders the briefing sections from existing event data', () => {
    renderWithProviders(<EventBriefingPage data={briefingData} />);

    expect(screen.getByRole('heading', { name: 'Event Briefing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Silverstone' })).toBeInTheDocument();
    expect(screen.getByText('GT weekend')).toBeInTheDocument();
    expect(screen.getByText('REF-123')).toBeInTheDocument();
    expect(screen.getByText('HOTEL-7')).toBeInTheDocument();
    expect(screen.getByText('Quiet room')).toBeInTheDocument();
    expect(screen.getByText('Meet by garage 4.')).toBeInTheDocument();
    expect(screen.getByText('Venue: The Paddock Arms')).toBeInTheDocument();
    expect(screen.getByText('Driver Two')).toBeInTheDocument();
    expect(screen.getAllByText('Trackside Hotel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Garage 4').length).toBeGreaterThan(0);
    expect(screen.getByText('Updated fields: date')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /provider booking/i })).toHaveAttribute(
      'href',
      'https://example.com/book',
    );
  });

  it('renders missing item prompts', () => {
    renderWithProviders(
      <EventBriefingPage
        data={{
          ...briefingData,
          booking: {
            ...briefingData.booking,
            status: 'maybe',
            arrivalDateTime: undefined,
            accommodationStatus: 'looking',
            accommodationName: undefined,
            garageBooked: false,
          },
          sharedPlan: null,
          costSummary: {
            ...briefingData.costSummary,
            totalPence: 0,
            groups: [],
            netSettlements: [],
          },
          readinessPrompts: [
            {
              id: 'confirm-attendance',
              severity: 'needs_attention',
              title: 'Confirm your attendance',
              description: 'You are marked as maybe for this event.',
              href: '/dashboard/bookings?booking=booking-1',
              actionLabel: 'Update trip',
            },
            {
              id: 'arrival-time',
              severity: 'needs_attention',
              title: 'Add arrival time',
              description: 'Add when you expect to arrive.',
              href: '/dashboard/bookings?booking=booking-1',
              actionLabel: 'Update stay',
            },
            {
              id: 'shared-plan',
              severity: 'optional',
              title: 'Add shared logistics',
              description: 'No shared planning note is saved.',
              href: '/dashboard/days?day=day-1',
              actionLabel: 'Open day plan',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Confirm your attendance')).toBeInTheDocument();
    expect(screen.getByText('Add arrival time')).toBeInTheDocument();
    expect(screen.getByText('Add shared logistics')).toBeInTheDocument();
  });

  it('does not expose other attendees private booking fields', () => {
    renderWithProviders(<EventBriefingPage data={briefingData} />);

    expect(screen.queryByText('Other private note')).not.toBeInTheDocument();
    expect(screen.queryByText('OTHER-REF')).not.toBeInTheDocument();
  });
});
