import type { AvailableDayType } from '~/lib/days/types';
import type { BookingRecord } from '~/lib/db/entities/booking.server';

const calendarProductId = '-//Grid Stay//Schedule//EN';
const dayTypeLabels: Record<AvailableDayType, string> = {
  race_day: 'Race day',
  test_day: 'Test day',
  track_day: 'Track day',
};

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string) {
  if (line.length <= 75) {
    return line;
  }

  const chunks = [line.slice(0, 75)];
  let remaining = line.slice(75);

  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }

  return chunks.join('\r\n');
}

function formatIcsDate(date: string) {
  return date.replaceAll('-', '');
}

function formatIcsTimestamp(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function getDayType(booking: BookingRecord): AvailableDayType | null {
  const value = booking.type ?? booking.dayId.split(':')[0];

  if (value === 'race_day' || value === 'test_day' || value === 'track_day') {
    return value;
  }

  return null;
}

function getDayTypeLabel(booking: BookingRecord) {
  const type = getDayType(booking);
  return type ? dayTypeLabels[type] : null;
}

function buildDescription(booking: BookingRecord) {
  const dayTypeLabel = getDayTypeLabel(booking);

  return [
    booking.description,
    dayTypeLabel ? `Type: ${dayTypeLabel}` : null,
    `Provider: ${booking.provider}`,
    `Status: ${titleCase(booking.status)}`,
    booking.accommodationName?.trim()
      ? `Stay: ${booking.accommodationName.trim()}`
      : null,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n');
}

function eventStatus(status: BookingRecord['status']) {
  return status === 'maybe' ? 'TENTATIVE' : 'CONFIRMED';
}

function eventSummary(booking: BookingRecord) {
  const dayTypeLabel = getDayTypeLabel(booking);
  const title = dayTypeLabel
    ? `${booking.circuit} - ${dayTypeLabel}`
    : booking.circuit;

  return booking.status === 'maybe'
    ? `${title} (${titleCase(booking.status)})`
    : title;
}

function buildEventLines(booking: BookingRecord, generatedAt: Date) {
  const dayTypeLabel = getDayTypeLabel(booking);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(`${booking.bookingId}@gridstay.app`)}`,
    `DTSTAMP:${formatIcsTimestamp(generatedAt)}`,
    `LAST-MODIFIED:${formatIcsTimestamp(booking.updatedAt)}`,
    `DTSTART;VALUE=DATE:${formatIcsDate(booking.date)}`,
    `DTEND;VALUE=DATE:${formatIcsDate(addDays(booking.date, 1))}`,
    `SUMMARY:${escapeIcsText(eventSummary(booking))}`,
    `LOCATION:${escapeIcsText(booking.circuit)}`,
    dayTypeLabel ? `CATEGORIES:${escapeIcsText(dayTypeLabel)}` : null,
    `DESCRIPTION:${escapeIcsText(buildDescription(booking))}`,
    `STATUS:${eventStatus(booking.status)}`,
    'TRANSP:TRANSPARENT',
    `X-GRID-STAY-STATUS:${booking.status}`,
    'END:VEVENT',
  ];

  return lines.filter((line): line is string => Boolean(line));
}

export function buildCalendarIcs(
  bookings: BookingRecord[],
  options: { generatedAt?: Date; calendarName?: string } = {},
) {
  const generatedAt = options.generatedAt ?? new Date();
  const calendarName = options.calendarName ?? 'Grid Stay Schedule';
  const activeBookings = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .sort((left, right) =>
      left.date === right.date
        ? left.circuit.localeCompare(right.circuit)
        : left.date.localeCompare(right.date),
    );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${calendarProductId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    ...activeBookings.flatMap((booking) =>
      buildEventLines(booking, generatedAt),
    ),
    'END:VCALENDAR',
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}
