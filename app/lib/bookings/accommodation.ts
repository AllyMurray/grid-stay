export const ACCOMMODATION_STATUS_VALUES = [
  'unknown',
  'not_required',
  'staying_at_track',
  'looking',
  'booked',
] as const;

export type AccommodationStatus = (typeof ACCOMMODATION_STATUS_VALUES)[number];

export interface AccommodationStatusInput {
  accommodationStatus?: string;
  accommodationName?: string | null;
  hotelId?: string | null;
}

export const ACCOMMODATION_STATUS_LABELS: Record<AccommodationStatus, string> = {
  unknown: 'Accommodation not set',
  not_required: 'No hotel needed',
  staying_at_track: 'Staying at the track',
  looking: 'Need a hotel',
  booked: 'Hotel booked',
};

export const ACCOMMODATION_STATUS_DESCRIPTIONS: Record<AccommodationStatus, string> = {
  unknown: 'No accommodation plan has been shared yet.',
  not_required: 'This is a day trip or no hotel is needed.',
  staying_at_track: 'Camping, campervan, tentbox, or another overnight stay at the circuit.',
  looking: 'Accommodation is still being arranged.',
  booked: 'A hotel or stay has been added.',
};

export function isAccommodationStatus(value: unknown): value is AccommodationStatus {
  return ACCOMMODATION_STATUS_VALUES.includes(value as AccommodationStatus);
}

export function resolveAccommodationStatus(
  input: AccommodationStatusInput | null | undefined,
): AccommodationStatus {
  if (!input) {
    return 'unknown';
  }

  if (isAccommodationStatus(input.accommodationStatus)) {
    return input.accommodationStatus;
  }

  if (input.hotelId?.trim() || input.accommodationName?.trim()) {
    return 'booked';
  }

  return 'unknown';
}

export function getAccommodationPlanSummary(input: AccommodationStatusInput | null | undefined) {
  const status = resolveAccommodationStatus(input);

  if (status === 'booked' && input) {
    return input.accommodationName?.trim() || 'Hotel booked';
  }

  return ACCOMMODATION_STATUS_LABELS[status];
}

export function hasBookedAccommodation(input: AccommodationStatusInput | null | undefined) {
  return resolveAccommodationStatus(input) === 'booked';
}

export function hasArrangedAccommodation(input: AccommodationStatusInput | null | undefined) {
  return ['booked', 'staying_at_track'].includes(resolveAccommodationStatus(input));
}

export function needsAccommodationPlan(input: AccommodationStatusInput | null | undefined) {
  return ['unknown', 'looking'].includes(resolveAccommodationStatus(input));
}
