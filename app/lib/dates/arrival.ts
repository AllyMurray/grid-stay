import { formatDateOnly } from './date-only';

const ARRIVAL_DATE_TIME_RE =
  /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const LEGACY_ARRIVAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeArrivalDateTime(
  value?: string | null,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = ARRIVAL_DATE_TIME_RE.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const [, date, hours, minutes, seconds = '00'] = match;
  return `${date} ${hours}:${minutes}:${seconds}`;
}

export function legacyArrivalTimeToDateTime(
  date: string,
  arrivalTime?: string | null,
): string | undefined {
  const trimmed = arrivalTime?.trim();
  if (!trimmed || !LEGACY_ARRIVAL_TIME_RE.test(trimmed)) {
    return undefined;
  }

  return `${date} ${trimmed}:00`;
}

export function resolveArrivalDateTime(booking: {
  date: string;
  arrivalDateTime?: string | null;
  arrivalTime?: string | null;
}): string | undefined {
  return (
    normalizeArrivalDateTime(booking.arrivalDateTime) ??
    legacyArrivalTimeToDateTime(booking.date, booking.arrivalTime)
  );
}

export function formatArrivalDateTime(value?: string | null): string | null {
  const normalized = normalizeArrivalDateTime(value);
  if (!normalized) {
    return null;
  }

  const match = ARRIVAL_DATE_TIME_RE.exec(normalized);
  if (!match) {
    return null;
  }

  const [, date, hours, minutes] = match;
  const dateLabel = formatDateOnly(date, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return `${dateLabel}, ${hours}:${minutes}`;
}
