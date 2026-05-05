import { describe, expect, it } from 'vitest';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { buildCalendarIcs } from './ics.server';

const booking: BookingRecord = {
  bookingId: 'booking-1',
  userId: 'user-1',
  userName: 'Driver One',
  userImage: '',
  dayId: 'day-1',
  date: '2026-05-03',
  type: 'race_day',
  status: 'booked',
  circuit: 'Silverstone',
  provider: 'MSV',
  bookingReference: 'REF-123',
  description: 'GT weekend',
  accommodationName: 'Trackside Hotel',
  accommodationReference: 'HOTEL-7',
  notes: 'Quiet room',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
};

describe('buildCalendarIcs', () => {
  it('exports active bookings as all-day events', () => {
    const calendar = buildCalendarIcs([booking], {
      generatedAt: new Date('2026-04-27T10:00:00.000Z'),
    });
    const unfoldedCalendar = calendar.replace(/\r\n /g, '');

    expect(calendar).toContain('BEGIN:VCALENDAR\r\n');
    expect(calendar).toContain('BEGIN:VEVENT\r\n');
    expect(calendar).toContain('DTSTART;VALUE=DATE:20260503\r\n');
    expect(calendar).toContain('DTEND;VALUE=DATE:20260504\r\n');
    expect(calendar).toContain('SUMMARY:Silverstone - Race day\r\n');
    expect(calendar).not.toContain('(Booked)');
    expect(calendar).toContain('CATEGORIES:Race day\r\n');
    expect(calendar).toContain('STATUS:CONFIRMED\r\n');
    expect(unfoldedCalendar).toContain('Type: Race day');
    expect(unfoldedCalendar).toContain('Provider: MSV');
    expect(unfoldedCalendar).toContain('Accommodation: Trackside Hotel');
  });

  it('marks maybe bookings in the event summary', () => {
    const calendar = buildCalendarIcs([
      {
        ...booking,
        status: 'maybe',
        type: 'track_day',
        circuit: 'Donington Park',
      },
    ]);

    expect(calendar).toContain(
      'SUMMARY:Donington Park - Track day (Maybe)\r\n',
    );
    expect(calendar).toContain('STATUS:TENTATIVE\r\n');
  });

  it('excludes cancelled bookings and private references', () => {
    const calendar = buildCalendarIcs([
      booking,
      {
        ...booking,
        bookingId: 'booking-2',
        dayId: 'day-2',
        status: 'cancelled',
        circuit: 'Donington Park',
      },
    ]);

    expect(calendar).toContain('Silverstone');
    expect(calendar).not.toContain('Donington Park');
    expect(calendar).not.toContain('REF-123');
    expect(calendar).not.toContain('HOTEL-7');
    expect(calendar).not.toContain('Quiet room');
  });

  it('can exclude maybe bookings and accommodation details', () => {
    const calendar = buildCalendarIcs(
      [
        booking,
        {
          ...booking,
          bookingId: 'booking-2',
          dayId: 'day-2',
          status: 'maybe',
          circuit: 'Donington Park',
        },
      ],
      {
        includeMaybe: false,
        includeStay: false,
      },
    );

    expect(calendar).toContain('Silverstone');
    expect(calendar).not.toContain('Donington Park');
    expect(calendar).not.toContain('Trackside Hotel');
  });

  it('includes track stays when accommodation details are enabled', () => {
    const calendar = buildCalendarIcs([
      {
        ...booking,
        accommodationStatus: 'staying_at_track',
        accommodationName: undefined,
        accommodationReference: undefined,
      },
    ]);
    const unfoldedCalendar = calendar.replace(/\r\n /g, '');

    expect(unfoldedCalendar).toContain('Accommodation: Staying at the track');
  });

  it('escapes reserved ICS text characters', () => {
    const calendar = buildCalendarIcs([
      {
        ...booking,
        circuit: 'Brands Hatch, Indy',
        description: 'Line one; line two\\final',
      },
    ]);

    expect(calendar).toContain('SUMMARY:Brands Hatch\\, Indy - Race day');
    expect(calendar).toContain('DESCRIPTION:Line one\\; line two\\\\final');
  });
});
