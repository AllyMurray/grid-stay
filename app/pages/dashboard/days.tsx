import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Link, useFetcher, useSearchParams } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type {
  BulkRaceSeriesBookingActionResult,
  CreateBookingActionResult,
  SharedStaySelectionActionResult,
} from '~/lib/bookings/actions.server';
import type { BookingStatus } from '~/lib/constants/enums';
import type { CostSplittingActionResult } from '~/lib/cost-splitting/actions.server';
import { formatDateOnly } from '~/lib/dates/date-only';
import type {
  DayBookingSnapshot,
  DayRow,
  DaysFeedData,
  DaysIndexData,
} from '~/lib/days/dashboard-feed.server';
import type {
  DaysPreferenceActionResult,
  SavedDaysFilters,
} from '~/lib/days/preferences.server';
import type {
  SharedDayPlan,
  SharedDayPlanActionResult,
} from '~/lib/days/shared-plan.server';
import type {
  DayAttendanceSummary as DayAttendanceDetails,
  GarageShareOption,
  SharedAttendee,
} from '~/lib/days/types';
import type {
  CostGroupSummary,
  EventCostSummary,
  NetCostSettlement,
} from '~/lib/db/services/cost-splitting.server';
import type { EventRequestActionResult } from '~/lib/db/services/event-request.server';
import type { GarageShareRequestActionResult } from '~/lib/garage-sharing/actions.server';

export interface AvailableDaysPageProps {
  data: DaysIndexData;
}

const UNSHARED_STAY_LABEL = 'No shared stay yet';

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compareDayRows(left: DayRow, right: DayRow) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  if (left.circuit !== right.circuit) {
    return left.circuit.localeCompare(right.circuit);
  }

  if (left.provider !== right.provider) {
    return left.provider.localeCompare(right.provider);
  }

  return left.dayId.localeCompare(right.dayId);
}

function mergeDayRows(primary: DayRow[], secondary: DayRow[]): DayRow[] {
  const merged = [...primary];
  const seenDayIds = new Set(primary.map((day) => day.dayId));

  for (const day of secondary) {
    if (seenDayIds.has(day.dayId)) {
      continue;
    }

    merged.push(day);
    seenDayIds.add(day.dayId);
  }

  return merged.sort(compareDayRows);
}

function createDaysFeedHref(
  filters: DaysIndexData['filters'],
  offset: number,
): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.series) {
    params.set('series', filters.series);
  }
  for (const circuit of filters.circuits) {
    params.append('circuit', circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  params.set('offset', String(offset));

  return `/api/dashboard/days-feed?${params.toString()}`;
}

function createDaysIndexHref(
  filters: DaysIndexData['filters'],
  selectedDayId?: string | null,
  navigationKey?: string | null,
): string {
  const params = new URLSearchParams();
  if (filters.month) {
    params.set('month', filters.month);
  }
  if (filters.series) {
    params.set('series', filters.series);
  }
  for (const circuit of filters.circuits) {
    params.append('circuit', circuit);
  }
  if (filters.provider) {
    params.set('provider', filters.provider);
  }
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (selectedDayId) {
    params.set('day', selectedDayId);
  }
  if (navigationKey) {
    params.set('nav', navigationKey);
  }

  const query = params.toString();
  return query ? `/dashboard/days?${query}` : '/dashboard/days';
}

function countActiveFilters(filters: DaysIndexData['filters']) {
  return (
    (filters.month ? 1 : 0) +
    (filters.series ? 1 : 0) +
    (filters.circuits.length > 0 ? 1 : 0) +
    (filters.provider ? 1 : 0) +
    (filters.type ? 1 : 0)
  );
}

function formatActiveFilterCount(value: number) {
  if (value === 0) {
    return 'No filters';
  }

  return `${value} ${value === 1 ? 'filter' : 'filters'} applied`;
}

function AvailableDaysHeaderMeta({
  totalCount,
  activeFilterCount,
  refreshedAt,
}: {
  totalCount: number;
  activeFilterCount: number;
  refreshedAt: string;
}) {
  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        <Badge color="brand" variant="light" size="lg" radius="sm" tt="none">
          {totalCount} matching days
        </Badge>
        <Badge
          color={activeFilterCount > 0 ? 'brand' : 'gray'}
          variant="light"
          size="lg"
          radius="sm"
          tt="none"
        >
          {formatActiveFilterCount(activeFilterCount)}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        Last refresh {formatRefreshedAt(refreshedAt)}
      </Text>
    </Stack>
  );
}

function DaysFilterHiddenInputs({
  filters,
}: {
  filters: DaysIndexData['filters'];
}) {
  return (
    <>
      <input type="hidden" name="month" value={filters.month} />
      <input type="hidden" name="series" value={filters.series} />
      {filters.circuits.map((circuit) => (
        <input key={circuit} type="hidden" name="circuit" value={circuit} />
      ))}
      <input type="hidden" name="provider" value={filters.provider} />
      <input type="hidden" name="type" value={filters.type} />
    </>
  );
}

function getSeriesFilterLabel(
  value: string,
  options: DaysIndexData['seriesOptions'],
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatSavedFilterSummary(
  filters: SavedDaysFilters,
  seriesOptions: DaysIndexData['seriesOptions'],
) {
  const parts = [
    filters.month ? formatMonthOption(filters.month) : null,
    filters.series ? getSeriesFilterLabel(filters.series, seriesOptions) : null,
    filters.circuits.length > 0 ? filters.circuits.join(', ') : null,
    filters.provider || null,
    filters.type ? titleCase(filters.type) : null,
  ].filter(Boolean);

  return parts.join(' • ') || 'No filters saved';
}

function getEventRequestFieldError(
  fieldErrors:
    | Extract<EventRequestActionResult, { ok: false }>['fieldErrors']
    | undefined,
  fieldName: keyof Extract<
    EventRequestActionResult,
    { ok: false }
  >['fieldErrors'],
) {
  return fieldErrors?.[fieldName]?.[0];
}

function EventRequestForm({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<EventRequestActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const success = fetcher.data?.ok ? fetcher.data : null;
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Missing track days, club days, or group road drives can be sent for
        admin review before they appear in the shared calendar.
      </Text>

      <fetcher.Form
        method="post"
        key={success?.request.requestId ?? 'event-request-form'}
      >
        <Stack gap="md">
          <input type="hidden" name="intent" value="createEventRequest" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              name="date"
              label="Date"
              type="date"
              required
              error={getEventRequestFieldError(fieldErrors, 'date')}
            />
            <Select
              name="type"
              label="Type"
              defaultValue="track_day"
              allowDeselect={false}
              data={[
                { value: 'track_day', label: 'Track day' },
                { value: 'test_day', label: 'Test day' },
                { value: 'race_day', label: 'Race day' },
                { value: 'road_drive', label: 'Road drive' },
              ]}
              error={getEventRequestFieldError(fieldErrors, 'type')}
            />
            <TextInput
              name="location"
              label="Location"
              placeholder="Circuit, route, or meet point"
              required
              error={getEventRequestFieldError(fieldErrors, 'location')}
            />
            <TextInput
              name="provider"
              label="Organiser"
              placeholder="Club, provider, or group"
              required
              error={getEventRequestFieldError(fieldErrors, 'provider')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              name="title"
              label="Title"
              placeholder="Caterham and Lotus 7 Club track day"
              required
              error={getEventRequestFieldError(fieldErrors, 'title')}
            />
            <TextInput
              name="bookingUrl"
              label="Booking or info link"
              placeholder="https://..."
              error={getEventRequestFieldError(fieldErrors, 'bookingUrl')}
            />
          </SimpleGrid>

          <Textarea
            name="description"
            label="Details"
            placeholder="Any useful context for the admin team"
            rows={3}
            error={getEventRequestFieldError(fieldErrors, 'description')}
          />

          <Group justify="space-between" gap="sm" align="center">
            <Text
              size="sm"
              c={formError ? 'red' : success ? 'green' : 'dimmed'}
            >
              {formError ??
                success?.message ??
                'Approved requests are added to Available Days for everyone.'}
            </Text>
            <Group gap="sm" justify="flex-end">
              <Button type="button" variant="default" onClick={onClose}>
                {success ? 'Done' : 'Cancel'}
              </Button>
              {success ? null : (
                <Button type="submit" loading={isSubmitting}>
                  Send for review
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </fetcher.Form>
    </Stack>
  );
}

function typeColor(type: DayRow['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
    case 'road_drive':
      return 'teal';
  }
}

function bookingColor(status: BookingStatus) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

function formatRefreshedAt(value: string) {
  if (!value) {
    return 'Waiting for the first refresh';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDayListDate(value: string) {
  return formatDateOnly(value, {
    day: 'numeric',
    month: 'short',
  });
}

function formatDayListWeekday(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
  });
}

function formatDayLongDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthOption(value: string) {
  const [year, month] = value.split('-').map((segment) => Number(segment));
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

interface DayAttendanceSummaryPreview {
  attendeeCount: number;
  accommodationNames: string[];
  garageOwnerCount?: number;
  garageOpenSpaceCount?: number;
}

interface AttendeeStatusGroup {
  key: BookingStatus;
  label: string;
  attendees: SharedAttendee[];
}

interface SharedStayGroup {
  label: string;
  attendees: SharedAttendee[];
}

interface LoadedDaysState {
  filterKey: string;
  days: DayRow[];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  attendanceSummaries: DaysFeedData['attendanceSummaries'];
  totalCount: number;
  nextOffset: number | null;
}

function createLoadedDaysState(data: DaysIndexData): LoadedDaysState {
  const days = data.selectedDay
    ? mergeDayRows([data.selectedDay], data.days)
    : data.days;

  return {
    filterKey: data.filterKey,
    days,
    myBookingsByDay: data.myBookingsByDay,
    attendanceSummaries: data.selectedDay
      ? {
          ...data.attendanceSummaries,
          ...(data.selectedDaySummary
            ? { [data.selectedDay.dayId]: data.selectedDaySummary }
            : {}),
        }
      : data.attendanceSummaries,
    totalCount: data.totalCount,
    nextOffset: data.nextOffset,
  };
}

function createDayAttendeesHref(dayId: string) {
  return `/api/days/${dayId}/attendees`;
}

function createDayCostsHref(dayId: string) {
  return `/api/days/${dayId}/costs`;
}

function getAttendanceSummary(
  summaries: DaysFeedData['attendanceSummaries'],
  dayId: string,
): DayAttendanceSummaryPreview {
  return (
    summaries[dayId] ?? {
      attendeeCount: 0,
      accommodationNames: [],
      garageOwnerCount: 0,
      garageOpenSpaceCount: 0,
    }
  );
}

function getAttendanceLabel(summary: DayAttendanceSummaryPreview) {
  return `${summary.attendeeCount} attending`;
}

function getAccommodationLabel(summary: DayAttendanceSummaryPreview) {
  if (summary.accommodationNames.length === 0) {
    return 'No shared stay added yet';
  }

  return summary.accommodationNames.join(', ');
}

function getGarageAvailabilityLabel(summary: DayAttendanceSummaryPreview) {
  const openSpaceCount = summary.garageOpenSpaceCount ?? 0;
  if (openSpaceCount > 0) {
    return `${openSpaceCount} garage ${openSpaceCount === 1 ? 'space' : 'spaces'} open`;
  }

  const garageOwnerCount = summary.garageOwnerCount ?? 0;
  if (garageOwnerCount > 0) {
    return `${garageOwnerCount} shared ${garageOwnerCount === 1 ? 'garage' : 'garages'} full`;
  }

  return 'No garage spaces shared yet';
}

function getDaySessionText(day: DayRow) {
  if (!day.description) {
    return day.provider;
  }

  return day.description.toLowerCase().includes(day.provider.toLowerCase())
    ? day.description
    : `${day.provider} • ${day.description}`;
}

function getDaySessionParts(day: DayRow) {
  const sessionText = getDaySessionText(day);
  const parts = sessionText
    .split(' • ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return {
      detail: sessionText,
      label: null,
    };
  }

  return {
    detail: parts.slice(0, -1).join(' • '),
    label: parts.at(-1) ?? null,
  };
}

function getDayTripText(booking?: DayBookingSnapshot) {
  if (!booking) {
    return 'Not in your bookings yet';
  }

  return `My trip: ${titleCase(booking.status)}`;
}

function getMyPlanSharedStay(booking?: DayBookingSnapshot) {
  if (!booking) {
    return 'No booking yet';
  }

  return booking.accommodationName?.trim() || 'No stay selected';
}

function getMyPlanGarage(booking?: DayBookingSnapshot) {
  if (!booking) {
    return 'No booking yet';
  }

  if (!booking.garageBooked) {
    return 'No garage shared';
  }

  return booking.garageLabel?.trim() || `${booking.garageCapacity ?? 2} cars`;
}

function getSavedStayCountLabel(count: number) {
  return count === 1 ? '1 saved stay' : `${count} saved stays`;
}

function groupAttendeesByStatus(
  attendees: SharedAttendee[],
): AttendeeStatusGroup[] {
  return [
    {
      key: 'booked',
      label: 'Booked',
      attendees: attendees.filter((attendee) => attendee.status === 'booked'),
    },
    {
      key: 'maybe',
      label: 'Maybe',
      attendees: attendees.filter((attendee) => attendee.status === 'maybe'),
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      attendees: attendees.filter(
        (attendee) => attendee.status === 'cancelled',
      ),
    },
  ];
}

function groupAttendeesBySharedStay(
  attendees: SharedAttendee[],
): SharedStayGroup[] {
  const groups = new Map<string, SharedAttendee[]>();

  for (const attendee of attendees) {
    if (attendee.status === 'cancelled') {
      continue;
    }

    const label = attendee.accommodationName?.trim() || UNSHARED_STAY_LABEL;
    const current = groups.get(label);

    if (current) {
      current.push(attendee);
      continue;
    }

    groups.set(label, [attendee]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNSHARED_STAY_LABEL) {
        return 1;
      }
      if (right === UNSHARED_STAY_LABEL) {
        return -1;
      }
      return left.localeCompare(right);
    })
    .map(([label, groupAttendees]) => ({
      label,
      attendees: groupAttendees,
    }));
}

function DayBookingAction({
  day,
  booking,
}: {
  day: DayRow;
  booking?: DayBookingSnapshot;
}) {
  const fetcher = useFetcher<CreateBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  if (booking) {
    return (
      <Stack gap={4} className="day-booking-action">
        <Button
          component={Link}
          to="/dashboard/bookings"
          size="sm"
          color="brand"
          variant={booking.status === 'booked' ? 'filled' : 'light'}
          className="day-booking-button"
        >
          Open my booking
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={4} className="day-booking-action">
      <fetcher.Form method="post" className="day-booking-form">
        <input type="hidden" name="dayId" value={day.dayId} />
        <Group gap="xs" wrap="wrap" className="day-booking-button-row">
          <Button
            type="submit"
            name="status"
            value="maybe"
            size="sm"
            variant="default"
            disabled={isSubmitting}
            className="day-booking-button"
          >
            Add as maybe
          </Button>
          <Button
            type="submit"
            name="status"
            value="booked"
            size="sm"
            color="brand"
            variant="filled"
            loading={isSubmitting}
            className="day-booking-button"
          >
            Add as booked
          </Button>
        </Group>
      </fetcher.Form>

      {formError ? (
        <Text size="xs" c="red" className="day-booking-error">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function DayProviderBookingLink({ day }: { day: DayRow }) {
  if (!day.bookingUrl) {
    return null;
  }

  return (
    <Anchor
      component="a"
      href={day.bookingUrl}
      target="_blank"
      rel="noreferrer"
      size="sm"
      fw={700}
    >
      Book on provider site
    </Anchor>
  );
}

function formatRaceSeriesCount(count: number) {
  return `${count} ${count === 1 ? 'event' : 'events'} in the series`;
}

function SeriesBookingAction({
  day,
  series,
}: {
  day: DayRow;
  series: NonNullable<DaysIndexData['raceSeriesByDayId'][string]>;
}) {
  const fetcher = useFetcher<BulkRaceSeriesBookingActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const missingCount = Math.max(
    series.totalCount - series.existingBookingCount,
    0,
  );
  const successResult = fetcher.data?.ok ? fetcher.data : null;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const successMessage = successResult
    ? `Added ${successResult.addedCount} ${
        successResult.addedCount === 1 ? 'event' : 'events'
      }. ${successResult.existingCount} existing ${
        successResult.existingCount === 1 ? 'booking' : 'bookings'
      } kept their status.`
    : null;

  return (
    <Stack gap={4} className="day-booking-action">
      <Text size="xs" fw={700} c="dimmed">
        {series.name}
      </Text>
      <Text size="xs" c="dimmed">
        {formatRaceSeriesCount(series.totalCount)} •{' '}
        {series.existingBookingCount} already in My Bookings
      </Text>
      <Text size="xs" c="dimmed">
        Existing event bookings keep their status and notes.
      </Text>
      <Button
        component={Link}
        to={`/dashboard/series/${series.key}`}
        size="sm"
        variant="subtle"
        w="fit-content"
      >
        Open series page
      </Button>

      {missingCount > 0 ? (
        <fetcher.Form method="post" className="day-booking-form">
          <input type="hidden" name="intent" value="addRaceSeries" />
          <input type="hidden" name="dayId" value={day.dayId} />
          <Group gap="xs" wrap="wrap" className="day-booking-button-row">
            <Button
              type="submit"
              name="status"
              value="maybe"
              size="sm"
              variant="default"
              disabled={isSubmitting}
              className="day-booking-button"
            >
              Add missing as maybe
            </Button>
            <Button
              type="submit"
              name="status"
              value="booked"
              size="sm"
              color="brand"
              variant="filled"
              loading={isSubmitting}
              className="day-booking-button"
            >
              Add missing as booked
            </Button>
          </Group>
        </fetcher.Form>
      ) : null}

      {missingCount === 0 ? (
        <Text size="xs" c="dimmed" className="day-booking-error">
          All linked events from this series are already in My Bookings.
        </Text>
      ) : null}

      {successMessage ? (
        <Text size="xs" c="dimmed" className="day-booking-error">
          {successMessage}
        </Text>
      ) : null}

      {formError ? (
        <Text size="xs" c="red" className="day-booking-error">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function DayListItem({
  day,
  summary,
  booking,
  selected,
  href,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  selected: boolean;
  href: string;
}) {
  const session = getDaySessionParts(day);

  return (
    <UnstyledButton
      component={Link}
      to={href}
      preventScrollReset
      aria-current={selected ? 'page' : undefined}
      aria-label={`${selected ? 'Hide details for' : 'View details for'} ${
        day.circuit
      }`}
      className="day-list-item"
      data-active={selected || undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Group align="flex-start" wrap="nowrap" gap="md" style={{ flex: 1 }}>
          <Stack gap={2} className="day-list-date">
            <Text size="sm" fw={800}>
              {formatDayListDate(day.date)}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {formatDayListWeekday(day.date)}
            </Text>
          </Stack>

          <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Group
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              gap="sm"
            >
              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" wrap="wrap">
                  <Text fw={700} lineClamp={1}>
                    {day.circuit}
                  </Text>
                  {session.label ? (
                    <Badge
                      variant="light"
                      color={typeColor(day.type)}
                      size="sm"
                    >
                      {session.label}
                    </Badge>
                  ) : null}
                </Group>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {session.detail}
                </Text>
              </Stack>

              <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
                <Badge color={typeColor(day.type)} size="sm">
                  {titleCase(day.type)}
                </Badge>
                {booking ? (
                  <Badge
                    color={bookingColor(booking.status)}
                    variant="light"
                    size="sm"
                  >
                    {titleCase(booking.status)}
                  </Badge>
                ) : null}
              </Stack>
            </Group>

            <Text size="sm" lineClamp={1}>
              {getAttendanceLabel(summary)} • {getAccommodationLabel(summary)} •{' '}
              {getGarageAvailabilityLabel(summary)}
            </Text>

            <Text size="xs" c="dimmed" lineClamp={1}>
              {getDayTripText(booking)}
            </Text>
          </Stack>
        </Group>

        <Text size="xs" fw={700} c={selected ? 'brand.7' : 'dimmed'}>
          <span className="row-toggle-label">{selected ? 'Hide' : 'View'}</span>
        </Text>
      </Group>
    </UnstyledButton>
  );
}

function DayListPanel({
  days,
  filters,
  attendanceSummaries,
  myBookingsByDay,
  selectedDayId,
}: {
  days: DayRow[];
  filters: DaysIndexData['filters'];
  attendanceSummaries: DaysFeedData['attendanceSummaries'];
  myBookingsByDay: Record<string, DayBookingSnapshot>;
  selectedDayId: string | null;
}) {
  return (
    <Paper className="days-list-panel" p="md">
      <Stack gap={0}>
        {days.map((day, index) => {
          const summary = getAttendanceSummary(attendanceSummaries, day.dayId);
          const booking = myBookingsByDay[day.dayId];
          const selected = day.dayId === selectedDayId;

          return (
            <Fragment key={day.dayId}>
              <DayListItem
                day={day}
                summary={summary}
                booking={booking}
                selected={selected}
                href={
                  selected
                    ? createDaysIndexHref(filters)
                    : createDaysIndexHref(filters, day.dayId)
                }
              />

              {index < days.length - 1 ? <Divider /> : null}
            </Fragment>
          );
        })}
      </Stack>
    </Paper>
  );
}

function getAttendeeGroupPreview(attendees: SharedAttendee[]) {
  if (attendees.length === 0) {
    return 'Nobody in this group yet';
  }

  const names = attendees.map((attendee) => attendee.userName);

  if (names.length <= 2) {
    return names.join(', ');
  }

  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

function AttendeeRosterList({ groups }: { groups: AttendeeStatusGroup[] }) {
  const [openGroupKey, setOpenGroupKey] = useState<BookingStatus | null>(null);

  return (
    <Stack gap={0}>
      {groups.map((group, index) => {
        const isOpen = openGroupKey === group.key;

        return (
          <Fragment key={group.key}>
            <UnstyledButton
              type="button"
              className="attendee-roster-row"
              data-open={isOpen || undefined}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Hide' : 'View'} ${group.label} attendees`}
              onClick={() =>
                setOpenGroupKey((current) =>
                  current === group.key ? null : group.key,
                )
              }
            >
              <Group justify="space-between" align="flex-start" gap="md">
                <Stack gap={6} className="attendee-roster-summary">
                  <Group gap="xs" wrap="wrap">
                    <Badge
                      variant="light"
                      color={bookingColor(group.key)}
                      size="sm"
                    >
                      {group.label}
                    </Badge>
                    <Text size="sm" fw={700}>
                      {group.attendees.length}
                    </Text>
                  </Group>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {getAttendeeGroupPreview(group.attendees)}
                  </Text>
                </Stack>
                <Text size="sm" fw={700} c={isOpen ? 'brand.7' : 'dimmed'}>
                  <span className="row-toggle-label">
                    {isOpen ? 'Hide' : 'View'}
                  </span>
                </Text>
              </Group>
            </UnstyledButton>

            {isOpen ? (
              <Box className="attendee-roster-panel">
                {group.attendees.length > 0 ? (
                  <Stack gap="xs">
                    {group.attendees.map((attendee, attendeeIndex) => (
                      <Fragment key={attendee.bookingId}>
                        <Group
                          justify="space-between"
                          align="flex-start"
                          gap="md"
                        >
                          <Text size="sm" fw={600}>
                            {attendee.userName}
                          </Text>
                          <Text size="sm" c="dimmed" ta="right">
                            {attendee.accommodationName?.trim() ||
                              UNSHARED_STAY_LABEL}
                          </Text>
                        </Group>
                        {attendeeIndex < group.attendees.length - 1 ? (
                          <Divider />
                        ) : null}
                      </Fragment>
                    ))}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    Nobody is in this group.
                  </Text>
                )}
              </Box>
            ) : null}

            {index < groups.length - 1 ? <Divider /> : null}
          </Fragment>
        );
      })}
    </Stack>
  );
}

function SharedStayAction({
  day,
  booking,
  accommodationName,
}: {
  day: DayRow;
  booking?: DayBookingSnapshot;
  accommodationName: string;
}) {
  const fetcher = useFetcher<SharedStaySelectionActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const isCurrentSelection =
    booking?.status !== 'cancelled' &&
    booking?.accommodationName?.trim() === accommodationName;
  const buttonLabel = isCurrentSelection
    ? 'Joined'
    : booking
      ? booking.status === 'cancelled'
        ? 'Rejoin stay'
        : 'Switch stay'
      : 'Join stay';

  return (
    <Stack gap={4} align="flex-end">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="useSharedStay" />
        <input type="hidden" name="dayId" value={day.dayId} />
        <input type="hidden" name="status" value="booked" />
        <input
          type="hidden"
          name="accommodationName"
          value={accommodationName}
        />
        <Button
          type="submit"
          size="sm"
          color="brand"
          variant={booking ? 'light' : 'filled'}
          loading={isSubmitting}
          disabled={isCurrentSelection}
        >
          {buttonLabel}
        </Button>
      </fetcher.Form>

      {formError ? (
        <Text size="xs" c="red" ta="right">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function getSharedStayState(
  booking: DayBookingSnapshot | undefined,
  accommodationName: string,
) {
  if (!booking) {
    return {
      label: 'Not in your plan',
      color: 'gray' as const,
    };
  }

  if (booking.status === 'cancelled') {
    return {
      label: 'Cancelled',
      color: 'gray' as const,
    };
  }

  if (booking.accommodationName?.trim() === accommodationName) {
    return {
      label: 'Current stay',
      color: 'green' as const,
    };
  }

  if (booking.accommodationName?.trim()) {
    return {
      label: 'On another stay',
      color: 'yellow' as const,
    };
  }

  return {
    label: 'No stay selected',
    color: 'gray' as const,
  };
}

function SharedStayAssignments({
  day,
  attendees,
  booking,
}: {
  day: DayRow;
  attendees: SharedAttendee[];
  booking?: DayBookingSnapshot;
}) {
  const groups = groupAttendeesBySharedStay(attendees);

  if (groups.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No active attendees are attached to this day yet.
      </Text>
    );
  }

  return (
    <Box>
      <Box className="shared-stay-header">
        <Text size="xs" fw={700} c="dimmed">
          Stay
        </Text>
        <Text size="xs" fw={700} c="dimmed">
          People on it
        </Text>
        <Text size="xs" fw={700} c="dimmed">
          Your state
        </Text>
        <Text size="xs" fw={700} c="dimmed" ta="right">
          Action
        </Text>
      </Box>

      <Stack gap={0}>
        {groups.map((group, index) => {
          const state =
            group.label === UNSHARED_STAY_LABEL
              ? {
                  label:
                    booking?.status === 'cancelled'
                      ? 'Cancelled'
                      : booking?.accommodationName?.trim()
                        ? 'On another stay'
                        : 'No stay selected',
                  color: 'gray' as const,
                }
              : getSharedStayState(booking, group.label);

          return (
            <Fragment key={group.label}>
              <Box
                className="shared-stay-row"
                data-current={
                  group.label !== UNSHARED_STAY_LABEL &&
                  booking?.status !== 'cancelled' &&
                  booking?.accommodationName?.trim() === group.label
                    ? 'true'
                    : undefined
                }
              >
                <Stack gap={4} className="shared-stay-cell">
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    className="shared-stay-cell-label"
                  >
                    Stay
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={700}>{group.label}</Text>
                    <Badge variant="light" color="gray" size="sm">
                      {group.attendees.length}{' '}
                      {group.attendees.length === 1 ? 'person' : 'people'}
                    </Badge>
                  </Group>
                </Stack>

                <Stack gap={4} className="shared-stay-cell">
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    className="shared-stay-cell-label"
                  >
                    People on it
                  </Text>
                  <Text size="sm" c="dimmed">
                    {group.attendees
                      .map((attendee) => attendee.userName)
                      .join(', ')}
                  </Text>
                </Stack>

                <Stack gap={4} className="shared-stay-cell">
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    className="shared-stay-cell-label"
                  >
                    Your state
                  </Text>
                  <Badge
                    variant="light"
                    color={state.color}
                    size="sm"
                    w="fit-content"
                  >
                    {state.label}
                  </Badge>
                </Stack>

                <Stack
                  gap={4}
                  className="shared-stay-cell shared-stay-action-cell"
                >
                  <Text
                    size="xs"
                    fw={700}
                    c="dimmed"
                    className="shared-stay-cell-label"
                  >
                    Action
                  </Text>
                  {group.label === UNSHARED_STAY_LABEL ? (
                    <Text size="sm" c="dimmed" ta="right">
                      Wait for someone to name the stay.
                    </Text>
                  ) : (
                    <SharedStayAction
                      day={day}
                      booking={booking}
                      accommodationName={group.label}
                    />
                  )}
                </Stack>
              </Box>
              {index < groups.length - 1 ? <Divider /> : null}
            </Fragment>
          );
        })}
      </Stack>
    </Box>
  );
}

function GarageShareRequestAction({
  day,
  booking,
  option,
}: {
  day: DayRow;
  booking?: DayBookingSnapshot;
  option: GarageShareOption;
}) {
  const fetcher = useFetcher<GarageShareRequestActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const isOwner = booking && option.ownerUserId === booking.userId;
  const activeBooking = booking && booking.status !== 'cancelled';
  const requestStatus = option.myRequestStatus;
  const canRequest =
    activeBooking &&
    !isOwner &&
    option.openSpaceCount > 0 &&
    requestStatus !== 'pending' &&
    requestStatus !== 'approved';
  const buttonLabel = !activeBooking
    ? 'Add day first'
    : isOwner
      ? 'Your garage'
      : requestStatus === 'pending'
        ? 'Requested'
        : requestStatus === 'approved'
          ? 'Shared'
          : option.openSpaceCount > 0
            ? 'Request space'
            : 'Full';

  return (
    <Stack gap={4} align="flex-end">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="requestGarageShare" />
        <input type="hidden" name="dayId" value={day.dayId} />
        <input
          type="hidden"
          name="garageBookingId"
          value={option.garageBookingId}
        />
        <input
          type="hidden"
          name="garageOwnerUserId"
          value={option.ownerUserId}
        />
        <Button
          type="submit"
          size="sm"
          color="orange"
          variant={canRequest ? 'filled' : 'light'}
          loading={isSubmitting}
          disabled={!canRequest}
        >
          {buttonLabel}
        </Button>
      </fetcher.Form>
      {formError ? (
        <Text size="xs" c="red" ta="right">
          {formError}
        </Text>
      ) : null}
    </Stack>
  );
}

function GarageShareAssignments({
  day,
  options,
  booking,
}: {
  day: DayRow;
  options: GarageShareOption[];
  booking?: DayBookingSnapshot;
}) {
  if (options.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No active attendees have shared garage space for this day yet.
      </Text>
    );
  }

  return (
    <Box>
      <Box className="shared-stay-header">
        <Text size="xs" fw={700} c="dimmed">
          Garage
        </Text>
        <Text size="xs" fw={700} c="dimmed">
          Capacity
        </Text>
        <Text size="xs" fw={700} c="dimmed">
          Requests
        </Text>
        <Text size="xs" fw={700} c="dimmed" ta="right">
          Action
        </Text>
      </Box>

      <Stack gap={0}>
        {options.map((option, index) => (
          <Fragment key={`${option.ownerUserId}:${option.garageBookingId}`}>
            <Box
              className="shared-stay-row"
              data-current={
                booking?.userId === option.ownerUserId ? 'true' : undefined
              }
            >
              <Stack gap={4} className="shared-stay-cell">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  className="shared-stay-cell-label"
                >
                  Garage
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Text fw={700}>{option.ownerName}</Text>
                  {option.garageLabel ? (
                    <Badge variant="light" color="gray">
                      {option.garageLabel}
                    </Badge>
                  ) : null}
                </Group>
              </Stack>

              <Stack gap={4} className="shared-stay-cell">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  className="shared-stay-cell-label"
                >
                  Capacity
                </Text>
                <Text size="sm" c="dimmed">
                  {option.openSpaceCount} of{' '}
                  {Math.max(option.garageCapacity - 1, 0)} shareable spaces open
                </Text>
              </Stack>

              <Stack gap={4} className="shared-stay-cell">
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  className="shared-stay-cell-label"
                >
                  Requests
                </Text>
                <Text size="sm" c="dimmed">
                  {option.approvedRequestCount} approved •{' '}
                  {option.pendingRequestCount} pending
                </Text>
              </Stack>

              <Stack
                gap={4}
                className="shared-stay-cell shared-stay-action-cell"
              >
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  className="shared-stay-cell-label"
                >
                  Action
                </Text>
                <GarageShareRequestAction
                  day={day}
                  booking={booking}
                  option={option}
                />
              </Stack>
            </Box>
            {index < options.length - 1 ? <Divider /> : null}
          </Fragment>
        ))}
      </Stack>
    </Box>
  );
}

const costCategoryOptions = [
  { value: 'track_day', label: 'Track day' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'garage', label: 'Garage' },
  { value: 'food', label: 'Food' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'other', label: 'Other' },
];

function formatMoneyPence(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(value / 100);
}

function formatMoneyInput(value: number) {
  return (value / 100).toFixed(2);
}

function ParticipantMultiSelect({
  options,
  defaultValue,
  error,
}: {
  options: EventCostSummary['availableParticipants'];
  defaultValue: string[];
  error?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);

  return (
    <>
      <MultiSelect
        label="People"
        data={options.map((participant) => ({
          value: participant.userId,
          label: participant.userName,
        }))}
        value={selected}
        onChange={setSelected}
        searchable
        error={error}
      />
      {selected.map((userId) => (
        <input
          key={userId}
          type="hidden"
          name="participantUserId"
          value={userId}
        />
      ))}
    </>
  );
}

function CostActionMessage({ result }: { result?: CostSplittingActionResult }) {
  if (!result || result.ok) {
    return null;
  }

  return (
    <Alert color="red" variant="light">
      {result.formError}
    </Alert>
  );
}

function CostGroupForm({
  day,
  summary,
  currentUser,
}: {
  day: DayRow;
  summary: EventCostSummary;
  currentUser: DaysIndexData['currentUser'];
}) {
  const fetcher = useFetcher<CostSplittingActionResult>();
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const defaultParticipants = summary.availableParticipants.some(
    (participant) => participant.userId === currentUser.id,
  )
    ? [currentUser.id]
    : [];

  return (
    <Paper withBorder p="md" radius="sm">
      <fetcher.Form method="post">
        <Stack gap="sm">
          <input type="hidden" name="intent" value="createCostGroup" />
          <input type="hidden" name="dayId" value={day.dayId} />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <TextInput
              name="name"
              label="Group"
              placeholder="Garage 4, Friday dinner..."
              error={fieldErrors?.name?.[0]}
            />
            <Select
              name="category"
              label="Category"
              defaultValue="food"
              data={costCategoryOptions}
              error={fieldErrors?.category?.[0]}
            />
            <ParticipantMultiSelect
              options={summary.availableParticipants}
              defaultValue={defaultParticipants}
              error={fieldErrors?.participantUserIds?.[0]}
            />
          </SimpleGrid>
          <Group justify="space-between" align="center">
            <CostActionMessage result={fetcher.data} />
            <Button type="submit" loading={fetcher.state !== 'idle'}>
              Add cost group
            </Button>
          </Group>
        </Stack>
      </fetcher.Form>
    </Paper>
  );
}

function CostGroupSettingsForm({
  group,
  summary,
}: {
  group: CostGroupSummary;
  summary: EventCostSummary;
}) {
  const updateFetcher = useFetcher<CostSplittingActionResult>();
  const deleteFetcher = useFetcher<CostSplittingActionResult>();
  const fieldErrors =
    updateFetcher.data && !updateFetcher.data.ok
      ? updateFetcher.data.fieldErrors
      : undefined;

  if (!group.canEdit) {
    return null;
  }

  return (
    <Paper withBorder p="sm" radius="sm">
      <Stack gap="sm">
        <updateFetcher.Form method="post">
          <Stack gap="sm">
            <input type="hidden" name="intent" value="updateCostGroup" />
            <input type="hidden" name="dayId" value={group.dayId} />
            <input type="hidden" name="groupId" value={group.groupId} />
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <TextInput
                name="name"
                label="Group"
                defaultValue={group.name}
                error={fieldErrors?.name?.[0]}
              />
              <Select
                name="category"
                label="Category"
                defaultValue={group.category}
                data={costCategoryOptions}
                error={fieldErrors?.category?.[0]}
              />
              <ParticipantMultiSelect
                options={[
                  ...summary.availableParticipants,
                  ...group.participants.filter(
                    (participant) =>
                      !summary.availableParticipants.some(
                        (available) => available.userId === participant.userId,
                      ),
                  ),
                ]}
                defaultValue={group.participants.map(
                  (participant) => participant.userId,
                )}
                error={fieldErrors?.participantUserIds?.[0]}
              />
            </SimpleGrid>
            <Group justify="space-between">
              <CostActionMessage result={updateFetcher.data} />
              <Button
                type="submit"
                variant="default"
                loading={updateFetcher.state !== 'idle'}
              >
                Save group
              </Button>
            </Group>
          </Stack>
        </updateFetcher.Form>

        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="deleteCostGroup" />
          <input type="hidden" name="dayId" value={group.dayId} />
          <input type="hidden" name="groupId" value={group.groupId} />
          <Group justify="space-between">
            <CostActionMessage result={deleteFetcher.data} />
            <Button
              type="submit"
              color="red"
              variant="subtle"
              size="compact-sm"
              loading={deleteFetcher.state !== 'idle'}
            >
              Delete group
            </Button>
          </Group>
        </deleteFetcher.Form>
      </Stack>
    </Paper>
  );
}

function CostExpenseForm({
  group,
  currentUser,
}: {
  group: CostGroupSummary;
  currentUser: DaysIndexData['currentUser'];
}) {
  const fetcher = useFetcher<CostSplittingActionResult>();
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const defaultPayer =
    group.participants.find(
      (participant) => participant.userId === currentUser.id,
    )?.userId ?? group.participants[0]?.userId;

  return (
    <fetcher.Form method="post">
      <Stack gap="xs">
        <input type="hidden" name="intent" value="createCostExpense" />
        <input type="hidden" name="dayId" value={group.dayId} />
        <input type="hidden" name="groupId" value={group.groupId} />
        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xs">
          <TextInput
            name="title"
            label="Expense"
            placeholder="Dinner, garage booking..."
            error={fieldErrors?.title?.[0]}
          />
          <NumberInput
            name="amount"
            label="Amount"
            decimalScale={2}
            fixedDecimalScale
            min={0.01}
            prefix="GBP "
            error={fieldErrors?.amountPence?.[0]}
          />
          <Select
            name="paidByUserId"
            label="Paid by"
            defaultValue={defaultPayer}
            data={group.participants.map((participant) => ({
              value: participant.userId,
              label: participant.userName,
            }))}
            error={fieldErrors?.paidByUserId?.[0]}
          />
          <TextInput
            name="notes"
            label="Notes"
            placeholder="Optional"
            error={fieldErrors?.notes?.[0]}
          />
        </SimpleGrid>
        <Group justify="space-between">
          <CostActionMessage result={fetcher.data} />
          <Button type="submit" size="sm" loading={fetcher.state !== 'idle'}>
            Add expense
          </Button>
        </Group>
      </Stack>
    </fetcher.Form>
  );
}

function CostExpenseRow({
  expense,
  group,
}: {
  expense: CostGroupSummary['expenses'][number];
  group: CostGroupSummary;
}) {
  const updateFetcher = useFetcher<CostSplittingActionResult>();
  const deleteFetcher = useFetcher<CostSplittingActionResult>();
  const fieldErrors =
    updateFetcher.data && !updateFetcher.data.ok
      ? updateFetcher.data.fieldErrors
      : undefined;

  if (!expense.canEdit) {
    return (
      <Group justify="space-between" align="flex-start" gap="md">
        <Stack gap={2}>
          <Text fw={700} size="sm">
            {expense.title}
          </Text>
          <Text size="xs" c="dimmed">
            Paid by {expense.paidByName}
            {expense.notes ? ` • ${expense.notes}` : ''}
          </Text>
        </Stack>
        <Text fw={800}>{formatMoneyPence(expense.amountPence)}</Text>
      </Group>
    );
  }

  return (
    <Stack gap="xs">
      <updateFetcher.Form method="post">
        <Stack gap="xs">
          <input type="hidden" name="intent" value="updateCostExpense" />
          <input type="hidden" name="dayId" value={expense.dayId} />
          <input type="hidden" name="groupId" value={expense.groupId} />
          <input type="hidden" name="expenseId" value={expense.expenseId} />
          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xs">
            <TextInput
              name="title"
              label="Expense"
              defaultValue={expense.title}
              error={fieldErrors?.title?.[0]}
            />
            <NumberInput
              name="amount"
              label="Amount"
              defaultValue={formatMoneyInput(expense.amountPence)}
              decimalScale={2}
              fixedDecimalScale
              min={0.01}
              prefix="GBP "
              error={fieldErrors?.amountPence?.[0]}
            />
            <Select
              name="paidByUserId"
              label="Paid by"
              defaultValue={expense.paidByUserId}
              data={group.participants.map((participant) => ({
                value: participant.userId,
                label: participant.userName,
              }))}
              error={fieldErrors?.paidByUserId?.[0]}
            />
            <TextInput
              name="notes"
              label="Notes"
              defaultValue={expense.notes ?? ''}
              error={fieldErrors?.notes?.[0]}
            />
          </SimpleGrid>
          <Group justify="space-between">
            <CostActionMessage result={updateFetcher.data} />
            <Group gap="xs">
              <Button
                type="submit"
                variant="default"
                size="compact-sm"
                loading={updateFetcher.state !== 'idle'}
              >
                Save expense
              </Button>
            </Group>
          </Group>
        </Stack>
      </updateFetcher.Form>

      <deleteFetcher.Form method="post">
        <input type="hidden" name="intent" value="deleteCostExpense" />
        <input type="hidden" name="dayId" value={expense.dayId} />
        <input type="hidden" name="groupId" value={expense.groupId} />
        <input type="hidden" name="expenseId" value={expense.expenseId} />
        <Group justify="space-between">
          <CostActionMessage result={deleteFetcher.data} />
          <Button
            type="submit"
            color="red"
            variant="subtle"
            size="compact-sm"
            loading={deleteFetcher.state !== 'idle'}
          >
            Delete expense
          </Button>
        </Group>
      </deleteFetcher.Form>
    </Stack>
  );
}

function SettlementStatusBadge({ status }: { status: string }) {
  const color =
    status === 'received' ? 'green' : status === 'sent' ? 'yellow' : 'gray';
  return (
    <Badge color={color} variant="light">
      {titleCase(status)}
    </Badge>
  );
}

function SettlementAction({ settlement }: { settlement: NetCostSettlement }) {
  const fetcher = useFetcher<CostSplittingActionResult>();
  const nextStatus = settlement.canConfirmReceived
    ? 'received'
    : settlement.canMarkSent
      ? 'sent'
      : null;

  if (!nextStatus) {
    return <CostActionMessage result={fetcher.data} />;
  }

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="updateCostSettlement" />
      <input type="hidden" name="dayId" value={settlement.dayId} />
      <input
        type="hidden"
        name="debtorUserId"
        value={settlement.debtorUserId}
      />
      <input
        type="hidden"
        name="creditorUserId"
        value={settlement.creditorUserId}
      />
      <input type="hidden" name="amountPence" value={settlement.amountPence} />
      <input type="hidden" name="currency" value={settlement.currency} />
      <input
        type="hidden"
        name="breakdownHash"
        value={settlement.breakdownHash}
      />
      <Group gap="xs">
        <CostActionMessage result={fetcher.data} />
        <Button
          type="submit"
          name="status"
          value={nextStatus}
          size="compact-sm"
          variant={nextStatus === 'received' ? 'filled' : 'default'}
          loading={fetcher.state !== 'idle'}
        >
          {nextStatus === 'received' ? 'Confirm received' : 'Mark sent'}
        </Button>
      </Group>
    </fetcher.Form>
  );
}

function SettlementRow({ settlement }: { settlement: NetCostSettlement }) {
  return (
    <Paper withBorder p="sm" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Group gap="xs" wrap="wrap">
              <Text size="sm" fw={800}>
                {settlement.debtorName} pays {settlement.creditorName}
              </Text>
              <SettlementStatusBadge status={settlement.status} />
            </Group>
            <Text size="xs" c="dimmed">
              {settlement.breakdown
                .map((item) => item.groupName)
                .filter((name, index, names) => names.indexOf(name) === index)
                .join(', ') || 'Cost split'}
            </Text>
          </Stack>
          <Text fw={900}>{formatMoneyPence(settlement.amountPence)}</Text>
        </Group>

        <Group justify="space-between" gap="sm">
          {settlement.paymentPreference ? (
            <Anchor
              href={settlement.paymentPreference.url}
              target="_blank"
              rel="noreferrer"
              size="sm"
            >
              Open {settlement.paymentPreference.label}
            </Anchor>
          ) : (
            <Text size="sm" c="dimmed">
              No payment link saved
            </Text>
          )}
          <SettlementAction settlement={settlement} />
        </Group>
      </Stack>
    </Paper>
  );
}

function CostGroupPanel({
  group,
  summary,
  currentUser,
}: {
  group: CostGroupSummary;
  summary: EventCostSummary;
  currentUser: DaysIndexData['currentUser'];
}) {
  return (
    <Paper withBorder p="md" radius="sm">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={4}>
            <Group gap="xs" wrap="wrap">
              <Text fw={800}>{group.name}</Text>
              <Badge variant="light">{titleCase(group.category)}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {group.participants
                .map((participant) => participant.userName)
                .join(', ')}
            </Text>
          </Stack>
          <Text fw={900}>{formatMoneyPence(group.totalPence)}</Text>
        </Group>

        <CostGroupSettingsForm group={group} summary={summary} />

        <Stack gap="xs">
          <Text size="sm" fw={700}>
            Expenses
          </Text>
          {group.expenses.length > 0 ? (
            <Stack gap="sm">
              {group.expenses.map((expense, index) => (
                <Stack key={expense.expenseId} gap="sm">
                  <CostExpenseRow expense={expense} group={group} />
                  {index < group.expenses.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No expenses in this group yet.
            </Text>
          )}
        </Stack>

        <Divider />

        <CostExpenseForm group={group} currentUser={currentUser} />
      </Stack>
    </Paper>
  );
}

function EventCostsPanel({
  day,
  summary,
  loading,
  currentUser,
}: {
  day: DayRow;
  summary?: EventCostSummary | null;
  loading?: boolean;
  currentUser: DaysIndexData['currentUser'];
}) {
  if (loading) {
    return (
      <Stack gap="sm">
        <Text fw={700}>Cost splitting</Text>
        <Group gap="sm">
          <Loader size="sm" color="brand" />
          <Text size="sm" c="dimmed">
            Loading cost splitting
          </Text>
        </Group>
      </Stack>
    );
  }

  if (!summary) {
    return (
      <Stack gap="sm">
        <Text fw={700}>Cost splitting</Text>
        <Text size="sm" c="dimmed">
          Cost groups are not available for this day yet.
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="md">
        <Stack gap={2}>
          <Text fw={700}>Cost splitting</Text>
          <Text size="sm" c="dimmed">
            Create participant-only groups for garages, hotels, meals, fuel, and
            other shared costs.
          </Text>
        </Stack>
        <Text size="sm" fw={800} c="dimmed">
          {formatMoneyPence(summary.totalPence)} total
        </Text>
      </Group>

      <Stack gap="xs">
        <Text size="sm" fw={700}>
          Event net
        </Text>
        {summary.netSettlements.length > 0 ? (
          <Stack gap="xs">
            {summary.netSettlements.map((settlement) => (
              <SettlementRow
                key={settlement.settlementId}
                settlement={settlement}
              />
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No one owes money on the visible groups yet.
          </Text>
        )}
      </Stack>

      <CostGroupForm day={day} summary={summary} currentUser={currentUser} />

      {summary.groups.length > 0 ? (
        <Stack gap="md">
          {summary.groups.map((group) => (
            <CostGroupPanel
              key={group.groupId}
              group={group}
              summary={summary}
              currentUser={currentUser}
            />
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No cost groups are visible to you for this day yet.
        </Text>
      )}
    </Stack>
  );
}

function SharedPlanNoteEditor({
  day,
  plan,
}: {
  day: DayRow;
  plan?: SharedDayPlan | null;
}) {
  const fetcher = useFetcher<SharedDayPlanActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const noteError =
    fetcher.data && !fetcher.data.ok
      ? fetcher.data.fieldErrors.notes?.[0]
      : null;
  const dinnerPlanError =
    fetcher.data && !fetcher.data.ok
      ? fetcher.data.fieldErrors.dinnerPlan?.[0]
      : null;
  const carShareError =
    fetcher.data && !fetcher.data.ok
      ? fetcher.data.fieldErrors.carShare?.[0]
      : null;
  const checklistError =
    fetcher.data && !fetcher.data.ok
      ? fetcher.data.fieldErrors.checklist?.[0]
      : null;
  const costSplitError =
    fetcher.data && !fetcher.data.ok
      ? fetcher.data.fieldErrors.costSplit?.[0]
      : null;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-end" gap="md">
        <Stack gap={2}>
          <Text fw={700}>Shared planning note</Text>
          <Text size="sm" c="dimmed">
            Keep group-visible logistics here, separate from private booking
            references.
          </Text>
        </Stack>
        {plan ? (
          <Text size="sm" c="dimmed">
            Updated by {plan.updatedByName}
          </Text>
        ) : null}
      </Group>

      <fetcher.Form method="post">
        <Stack gap="xs">
          <input type="hidden" name="intent" value="saveSharedDayPlan" />
          <input type="hidden" name="dayId" value={day.dayId} />
          <Textarea
            name="notes"
            aria-label="Shared planning note"
            placeholder="Meeting point, dinner booking, convoy notes..."
            rows={4}
            maxLength={1000}
            defaultValue={plan?.notes ?? ''}
            error={noteError}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
            <Textarea
              name="dinnerPlan"
              label="Dinner"
              placeholder="Restaurant, booking time, headcount..."
              rows={3}
              maxLength={1000}
              defaultValue={plan?.dinnerPlan ?? ''}
              error={dinnerPlanError}
            />
            <Textarea
              name="carShare"
              label="Car share"
              placeholder="Passenger spaces, convoy timings, lifts..."
              rows={3}
              maxLength={1000}
              defaultValue={plan?.carShare ?? ''}
              error={carShareError}
            />
            <Textarea
              name="checklist"
              label="Checklist"
              placeholder="Tickets, fuel, kit, tools..."
              rows={3}
              maxLength={1000}
              defaultValue={plan?.checklist ?? ''}
              error={checklistError}
            />
            <Textarea
              name="costSplit"
              label="Cost split"
              placeholder="Shared costs, who paid, settlement notes..."
              rows={3}
              maxLength={1000}
              defaultValue={plan?.costSplit ?? ''}
              error={costSplitError}
            />
          </SimpleGrid>
          <Group justify="space-between" align="center" gap="md">
            <Text size="xs" c={formError ? 'red' : 'dimmed'}>
              {formError ?? 'Leave every field blank and save to clear it.'}
            </Text>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Save shared plan
            </Button>
          </Group>
        </Stack>
      </fetcher.Form>
    </Stack>
  );
}

function DayDetailContent({
  day,
  summary,
  booking,
  series,
  sharedPlan,
  costSummary,
  costLoading,
  currentUser,
  attendanceDetails,
  attendanceLoading,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  series?: DaysIndexData['raceSeriesByDayId'][string];
  sharedPlan?: SharedDayPlan | null;
  costSummary?: EventCostSummary | null;
  costLoading?: boolean;
  currentUser: DaysIndexData['currentUser'];
  attendanceDetails?: DayAttendanceDetails | null;
  attendanceLoading?: boolean;
}) {
  const attendeeStatusGroups = useMemo(
    () =>
      attendanceDetails
        ? groupAttendeesByStatus(attendanceDetails.attendees)
        : [],
    [attendanceDetails],
  );

  return (
    <Stack gap="lg">
      <Stack gap="md" className="day-detail-header">
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
          <Stack gap="md" className="day-detail-heading">
            <Stack gap={4}>
              <Text size="sm" fw={700} c="brand.7">
                Selected day
              </Text>
              <Title order={2}>{day.circuit}</Title>
              <Text size="sm" c="dimmed">
                {formatDayLongDate(day.date)} • {day.provider}
              </Text>
              {day.description ? (
                <Text size="sm">{day.description}</Text>
              ) : null}
            </Stack>

            <Group gap="xs" wrap="wrap" className="day-detail-meta-items">
              <Badge color={typeColor(day.type)} size="lg">
                {titleCase(day.type)}
              </Badge>
              {booking ? (
                <Badge color={bookingColor(booking.status)} variant="light">
                  {titleCase(booking.status)}
                </Badge>
              ) : (
                <Badge variant="light" color="gray">
                  Not added
                </Badge>
              )}
              <DayProviderBookingLink day={day} />
            </Group>
          </Stack>

          <Stack gap="md" className="day-detail-actions">
            <Stack gap={6} className="day-detail-action-group">
              <Text size="xs" fw={700} c="dimmed">
                This day
              </Text>
              <DayBookingAction day={day} booking={booking} />
            </Stack>
            {series ? (
              <Stack gap={6} className="day-detail-action-group">
                <Text size="xs" fw={700} c="dimmed">
                  Entire series
                </Text>
                <SeriesBookingAction day={day} series={series} />
              </Stack>
            ) : null}
          </Stack>
        </SimpleGrid>
      </Stack>

      <Box className="selected-day-summary">
        <Box className="selected-day-summary-group">
          <Text size="xs" fw={700} c="dimmed">
            My plan
          </Text>
          <Box className="selected-day-summary-items">
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Status
              </Text>
              <Text size="sm" fw={700} className="selected-day-summary-value">
                {booking ? titleCase(booking.status) : 'Not added'}
              </Text>
            </Box>
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Shared stay
              </Text>
              <Text
                size="sm"
                fw={700}
                lineClamp={2}
                className="selected-day-summary-value"
              >
                {getMyPlanSharedStay(booking)}
              </Text>
            </Box>
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Garage
              </Text>
              <Text
                size="sm"
                fw={700}
                lineClamp={2}
                className="selected-day-summary-value"
              >
                {getMyPlanGarage(booking)}
              </Text>
            </Box>
          </Box>
        </Box>

        <Box className="selected-day-summary-group">
          <Text size="xs" fw={700} c="dimmed">
            Group plan
          </Text>
          <Box className="selected-day-summary-items">
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Attending
              </Text>
              <Text size="sm" fw={700} className="selected-day-summary-value">
                {summary.attendeeCount}
              </Text>
            </Box>
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Saved stays
              </Text>
              <Text size="sm" fw={700} className="selected-day-summary-value">
                {getSavedStayCountLabel(summary.accommodationNames.length)}
              </Text>
            </Box>
            <Box className="selected-day-summary-item">
              <Text size="xs" c="dimmed">
                Garage spaces
              </Text>
              <Text size="sm" fw={700} className="selected-day-summary-value">
                {summary.garageOpenSpaceCount ?? 0}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      <Divider />

      <SharedPlanNoteEditor day={day} plan={sharedPlan} />

      <Divider />

      <EventCostsPanel
        day={day}
        summary={costSummary}
        loading={costLoading}
        currentUser={currentUser}
      />

      <Divider />

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Garage sharing</Text>
            <Text size="sm" c="dimmed">
              See who has a garage and request one of the spare spaces.
            </Text>
          </Stack>
          <Text size="sm" fw={700} c="dimmed">
            {summary.garageOpenSpaceCount ?? 0} open
          </Text>
        </Group>

        {attendanceLoading ? (
          <Group gap="sm">
            <Loader size="sm" color="brand" />
            <Text size="sm" c="dimmed">
              Loading garage sharing
            </Text>
          </Group>
        ) : attendanceDetails ? (
          <GarageShareAssignments
            day={day}
            options={attendanceDetails.garageShareOptions ?? []}
            booking={booking}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Garage sharing is not available yet.
          </Text>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Attendee roster</Text>
            <Text size="sm" c="dimmed">
              Open one status group at a time when you need names, without
              stretching the whole page.
            </Text>
          </Stack>
          {attendanceDetails ? (
            <Text size="sm" fw={700} c="dimmed">
              {attendanceDetails.attendees.length} total
            </Text>
          ) : null}
        </Group>

        {attendanceLoading ? (
          <Group gap="sm">
            <Loader size="sm" color="brand" />
            <Text size="sm" c="dimmed">
              Loading attendee roster
            </Text>
          </Group>
        ) : attendanceDetails ? (
          <Stack gap="md">
            <Group gap="md" wrap="wrap">
              {attendeeStatusGroups.map((group) => (
                <Group key={group.key} gap={6} wrap="nowrap">
                  <Text size="sm" fw={700}>
                    {group.label}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {group.attendees.length}
                  </Text>
                </Group>
              ))}
            </Group>
            <AttendeeRosterList groups={attendeeStatusGroups} />
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Attendee details are not available yet.
          </Text>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Group justify="space-between" align="flex-end" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Shared stay</Text>
            <Text size="sm" c="dimmed">
              See who is attached to each shared stay name, then copy one into
              your booking without leaving this page.
            </Text>
          </Stack>
          <Text size="sm" fw={700} c="dimmed">
            {summary.accommodationNames.length} saved
          </Text>
        </Group>

        {attendanceLoading ? (
          <Group gap="sm">
            <Loader size="sm" color="brand" />
            <Text size="sm" c="dimmed">
              Loading shared stay assignments
            </Text>
          </Group>
        ) : attendanceDetails ? (
          <SharedStayAssignments
            day={day}
            attendees={attendanceDetails.attendees}
            booking={booking}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Shared stay assignments are not available yet.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

function DayDetailPanel({
  day,
  summary,
  booking,
  series,
  sharedPlan,
  costSummary,
  costLoading,
  currentUser,
  attendanceDetails,
  attendanceLoading,
}: {
  day: DayRow;
  summary: DayAttendanceSummaryPreview;
  booking?: DayBookingSnapshot;
  series?: DaysIndexData['raceSeriesByDayId'][string];
  sharedPlan?: SharedDayPlan | null;
  costSummary?: EventCostSummary | null;
  costLoading?: boolean;
  currentUser: DaysIndexData['currentUser'];
  attendanceDetails?: DayAttendanceDetails | null;
  attendanceLoading?: boolean;
}) {
  return (
    <Paper className="days-detail-panel" p={{ base: 'md', sm: 'lg' }}>
      <DayDetailContent
        day={day}
        summary={summary}
        booking={booking}
        series={series}
        sharedPlan={sharedPlan}
        costSummary={costSummary}
        costLoading={costLoading}
        currentUser={currentUser}
        attendanceDetails={attendanceDetails}
        attendanceLoading={attendanceLoading}
      />
    </Paper>
  );
}

export function AvailableDaysPage({ data }: AvailableDaysPageProps) {
  const [searchParams] = useSearchParams();
  const feedFetcher = useFetcher<DaysFeedData>();
  const attendanceFetcher = useFetcher<DayAttendanceDetails>();
  const adjacentAttendanceFetcher = useFetcher<DayAttendanceDetails>();
  const costFetcher = useFetcher<EventCostSummary | null>();
  const preferenceFetcher = useFetcher<DaysPreferenceActionResult>();
  const [loadedDays, setLoadedDays] = useState<LoadedDaysState>(() =>
    createLoadedDaysState(data),
  );
  const [attendanceDetailsByDay, setAttendanceDetailsByDay] = useState<
    Record<string, DayAttendanceDetails>
  >(() =>
    data.selectedDay && data.selectedDayAttendance
      ? { [data.selectedDay.dayId]: data.selectedDayAttendance }
      : {},
  );
  const [costSummariesByDay, setCostSummariesByDay] = useState<
    Record<string, EventCostSummary | null>
  >(() =>
    data.selectedDay
      ? { [data.selectedDay.dayId]: data.selectedDayCostSummary }
      : {},
  );
  const [eventRequestModalOpened, setEventRequestModalOpened] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const previousFilterKeyRef = useRef(data.filterKey);
  const pendingOffsetRef = useRef<number | null>(null);
  const pendingAttendanceDayIdRef = useRef<string | null>(null);
  const pendingAdjacentAttendanceDayIdRef = useRef<string | null>(null);
  const pendingCostDayIdRef = useRef<string | null>(null);
  const processedOffsetsRef = useRef(new Set<number>([data.offset]));
  const activeFilterCount = countActiveFilters(data.filters);
  const savedFilterCount = data.savedFilters
    ? countActiveFilters(data.savedFilters)
    : 0;
  const savedFilterHref = data.savedFilters
    ? createDaysIndexHref(data.savedFilters)
    : null;
  const preferenceSubmitting = preferenceFetcher.state !== 'idle';
  const preferenceMessage = !preferenceFetcher.data
    ? null
    : preferenceFetcher.data.ok
      ? preferenceFetcher.data.message
      : preferenceFetcher.data.formError;
  const selectedDayId = searchParams.get('day')?.trim() || null;
  const [selectedSeries, setSelectedSeries] = useState(data.filters.series);
  const [selectedCircuits, setSelectedCircuits] = useState(
    data.filters.circuits,
  );
  const orderedLoadedDays = useMemo(
    () => [...loadedDays.days].sort(compareDayRows),
    [loadedDays.days],
  );
  const loadMoreHref = useMemo(
    () =>
      loadedDays.nextOffset === null
        ? null
        : createDaysFeedHref(data.filters, loadedDays.nextOffset),
    [data.filters, loadedDays.nextOffset],
  );
  const circuitOptionsForSelectedSeries = useMemo(() => {
    if (!selectedSeries) {
      return data.circuitOptions;
    }

    return (
      data.seriesOptions.find((option) => option.value === selectedSeries)
        ?.circuitOptions ?? []
    );
  }, [data.circuitOptions, data.seriesOptions, selectedSeries]);
  const circuitOptionSet = useMemo(
    () => new Set(circuitOptionsForSelectedSeries),
    [circuitOptionsForSelectedSeries],
  );

  useEffect(() => {
    setSelectedSeries(data.filters.series);
    setSelectedCircuits(data.filters.circuits);
  }, [data.filters.circuits, data.filters.series]);

  useEffect(() => {
    setSelectedCircuits((current) => {
      const next = current.filter((circuit) => circuitOptionSet.has(circuit));
      return next.length === current.length ? current : next;
    });
  }, [circuitOptionSet]);

  useEffect(() => {
    const filtersChanged = previousFilterKeyRef.current !== data.filterKey;
    previousFilterKeyRef.current = data.filterKey;
    pendingOffsetRef.current = null;
    if (filtersChanged) {
      processedOffsetsRef.current = new Set([data.offset]);
    }

    setLoadedDays((current) => {
      if (filtersChanged || current.filterKey !== data.filterKey) {
        return createLoadedDaysState(data);
      }

      const days = mergeDayRows(data.days, current.days);

      return {
        filterKey: data.filterKey,
        days,
        myBookingsByDay: data.myBookingsByDay,
        attendanceSummaries: {
          ...current.attendanceSummaries,
          ...data.attendanceSummaries,
        },
        totalCount: data.totalCount,
        nextOffset: days.length < data.totalCount ? days.length : null,
      };
    });
  }, [data]);

  useEffect(() => {
    const page = feedFetcher.data;
    if (!page || page.filterKey !== previousFilterKeyRef.current) {
      return;
    }

    pendingOffsetRef.current = null;
    if (processedOffsetsRef.current.has(page.offset)) {
      return;
    }

    processedOffsetsRef.current.add(page.offset);
    setLoadedDays((current) => {
      if (current.filterKey !== page.filterKey) {
        return current;
      }

      const days = mergeDayRows(current.days, page.days);

      return {
        ...current,
        days,
        attendanceSummaries: {
          ...current.attendanceSummaries,
          ...page.attendanceSummaries,
        },
        totalCount: page.totalCount,
        nextOffset: page.nextOffset,
      };
    });
  }, [feedFetcher.data]);

  useEffect(() => {
    if (!data.selectedDay || !data.selectedDayAttendance) {
      return;
    }

    const { dayId } = data.selectedDay;
    const attendance = data.selectedDayAttendance;
    setAttendanceDetailsByDay((current) => ({
      ...current,
      [dayId]: attendance,
    }));
  }, [data.selectedDay, data.selectedDayAttendance]);

  useEffect(() => {
    if (!data.selectedDay) {
      return;
    }

    const { dayId } = data.selectedDay;
    setCostSummariesByDay((current) => ({
      ...current,
      [dayId]: data.selectedDayCostSummary,
    }));
  }, [data.selectedDay, data.selectedDayCostSummary]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (
      !sentinel ||
      !loadMoreHref ||
      loadedDays.nextOffset === null ||
      feedFetcher.state !== 'idle'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        if (pendingOffsetRef.current === loadedDays.nextOffset) {
          return;
        }

        pendingOffsetRef.current = loadedDays.nextOffset;
        feedFetcher.load(loadMoreHref);
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [feedFetcher, loadMoreHref, loadedDays.nextOffset, feedFetcher.state]);

  const selectedDayFromUrl =
    orderedLoadedDays.find((day) => day.dayId === selectedDayId) ?? null;
  const hasLoadedFullSet = orderedLoadedDays.length >= loadedDays.totalCount;
  const selectedDayIndex = selectedDayFromUrl
    ? orderedLoadedDays.findIndex(
        (day) => day.dayId === selectedDayFromUrl.dayId,
      )
    : -1;
  const selectedDayMatchesRouteData =
    Boolean(selectedDayFromUrl) &&
    data.selectedDay?.dayId === selectedDayFromUrl?.dayId;
  const selectedDayPosition =
    selectedDayFromUrl && hasLoadedFullSet
      ? selectedDayIndex + 1
      : selectedDayMatchesRouteData
        ? data.selectedDayPosition
        : selectedDayFromUrl
          ? null
          : null;
  const previousSelectedDay =
    selectedDayFromUrl && hasLoadedFullSet
      ? selectedDayIndex > 0
        ? orderedLoadedDays[selectedDayIndex - 1]
        : null
      : selectedDayMatchesRouteData
        ? data.selectedDayPrevious
        : selectedDayIndex > 0
          ? orderedLoadedDays[selectedDayIndex - 1]
          : null;
  const nextSelectedDay =
    selectedDayFromUrl && hasLoadedFullSet
      ? selectedDayIndex >= 0 && selectedDayIndex < orderedLoadedDays.length - 1
        ? orderedLoadedDays[selectedDayIndex + 1]
        : null
      : selectedDayMatchesRouteData
        ? data.selectedDayNext
        : selectedDayIndex >= 0 &&
            selectedDayIndex < orderedLoadedDays.length - 1
          ? orderedLoadedDays[selectedDayIndex + 1]
          : null;
  const selectedDayAttendanceDetails = selectedDayFromUrl
    ? (attendanceDetailsByDay[selectedDayFromUrl.dayId] ?? null)
    : null;
  const hasSelectedDayCostSummary =
    selectedDayFromUrl &&
    Object.hasOwn(costSummariesByDay, selectedDayFromUrl.dayId);
  const selectedDayCostSummary =
    selectedDayFromUrl && hasSelectedDayCostSummary
      ? (costSummariesByDay[selectedDayFromUrl.dayId] ?? null)
      : null;
  const selectedDaySeries = selectedDayFromUrl
    ? data.raceSeriesByDayId[selectedDayFromUrl.dayId]
    : null;
  const attendanceLoading =
    Boolean(selectedDayFromUrl) &&
    !selectedDayAttendanceDetails &&
    (attendanceFetcher.state !== 'idle' ||
      pendingAttendanceDayIdRef.current === selectedDayFromUrl?.dayId);
  const costLoading =
    Boolean(selectedDayFromUrl) &&
    !hasSelectedDayCostSummary &&
    (costFetcher.state !== 'idle' ||
      pendingCostDayIdRef.current === selectedDayFromUrl?.dayId);

  useEffect(() => {
    if (!selectedDayFromUrl || selectedDayAttendanceDetails) {
      return;
    }

    if (attendanceFetcher.state !== 'idle') {
      return;
    }

    pendingAttendanceDayIdRef.current = selectedDayFromUrl.dayId;
    attendanceFetcher.load(createDayAttendeesHref(selectedDayFromUrl.dayId));
  }, [
    attendanceFetcher,
    attendanceFetcher.state,
    selectedDayAttendanceDetails,
    selectedDayFromUrl,
  ]);

  useEffect(() => {
    if (!attendanceFetcher.data || !pendingAttendanceDayIdRef.current) {
      return;
    }

    const dayId = pendingAttendanceDayIdRef.current;
    pendingAttendanceDayIdRef.current = null;
    setAttendanceDetailsByDay((current) => ({
      ...current,
      [dayId]: attendanceFetcher.data!,
    }));
  }, [attendanceFetcher.data]);

  useEffect(() => {
    if (!selectedDayFromUrl || hasSelectedDayCostSummary) {
      return;
    }

    if (costFetcher.state !== 'idle') {
      return;
    }

    pendingCostDayIdRef.current = selectedDayFromUrl.dayId;
    costFetcher.load(createDayCostsHref(selectedDayFromUrl.dayId));
  }, [
    costFetcher,
    costFetcher.state,
    hasSelectedDayCostSummary,
    selectedDayFromUrl,
  ]);

  useEffect(() => {
    if (!pendingCostDayIdRef.current) {
      return;
    }

    if (costFetcher.data === undefined) {
      return;
    }

    const dayId = pendingCostDayIdRef.current;
    pendingCostDayIdRef.current = null;
    setCostSummariesByDay((current) => ({
      ...current,
      [dayId]: costFetcher.data ?? null,
    }));
  }, [costFetcher.data]);

  useEffect(() => {
    if (
      !selectedDayFromUrl ||
      loadedDays.nextOffset === null ||
      feedFetcher.state !== 'idle'
    ) {
      return;
    }

    if (pendingOffsetRef.current === loadedDays.nextOffset) {
      return;
    }

    pendingOffsetRef.current = loadedDays.nextOffset;
    feedFetcher.load(createDaysFeedHref(data.filters, loadedDays.nextOffset));
  }, [
    data.filters,
    feedFetcher,
    feedFetcher.state,
    loadedDays.nextOffset,
    selectedDayFromUrl,
  ]);

  useEffect(() => {
    const adjacentDays = [previousSelectedDay, nextSelectedDay].filter(
      (day): day is DayRow => Boolean(day),
    );
    const missingAdjacentDay = adjacentDays.find(
      (day) => !attendanceDetailsByDay[day.dayId],
    );

    if (!missingAdjacentDay || adjacentAttendanceFetcher.state !== 'idle') {
      return;
    }

    pendingAdjacentAttendanceDayIdRef.current = missingAdjacentDay.dayId;
    adjacentAttendanceFetcher.load(
      createDayAttendeesHref(missingAdjacentDay.dayId),
    );
  }, [
    adjacentAttendanceFetcher,
    adjacentAttendanceFetcher.state,
    attendanceDetailsByDay,
    nextSelectedDay,
    previousSelectedDay,
  ]);

  useEffect(() => {
    if (
      !adjacentAttendanceFetcher.data ||
      !pendingAdjacentAttendanceDayIdRef.current
    ) {
      return;
    }

    const dayId = pendingAdjacentAttendanceDayIdRef.current;
    pendingAdjacentAttendanceDayIdRef.current = null;
    setAttendanceDetailsByDay((current) => ({
      ...current,
      [dayId]: adjacentAttendanceFetcher.data!,
    }));
  }, [adjacentAttendanceFetcher.data]);

  return (
    <Stack gap="xl">
      <Modal
        opened={eventRequestModalOpened}
        onClose={() => setEventRequestModalOpened(false)}
        title="Suggest an event"
        size="lg"
        centered
      >
        <EventRequestForm onClose={() => setEventRequestModalOpened(false)} />
      </Modal>

      <PageHeader
        eyebrow="Shared schedule"
        title="Available Days"
        description="Open one live date at a time to review the group plan, shared stay, and your next trip action."
        meta={
          <AvailableDaysHeaderMeta
            totalCount={loadedDays.totalCount}
            activeFilterCount={activeFilterCount}
            refreshedAt={data.refreshedAt}
          />
        }
        actions={
          <>
            {data.canCreateManualDays ? (
              <Button
                component={Link}
                to="/dashboard/manual-days"
                variant="default"
              >
                Manage manual days
              </Button>
            ) : null}
            <Button component={Link} to="/dashboard/bookings" variant="default">
              Open my bookings
            </Button>
            <Button
              type="button"
              variant="light"
              onClick={() => setEventRequestModalOpened(true)}
            >
              Suggest event
            </Button>
          </>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>Refine the feed</Title>
              <Text size="sm" c="dimmed">
                Narrow the calendar by month, race series, circuit, provider, or
                day type.
              </Text>
            </Stack>
            <Group gap="xs" justify="flex-end">
              {activeFilterCount > 0 ? (
                <preferenceFetcher.Form
                  method="post"
                  aria-label="Save applied filters"
                >
                  <Group gap="xs" align="flex-end" wrap="wrap">
                    <input
                      type="hidden"
                      name="intent"
                      value="saveDaysFilters"
                    />
                    <DaysFilterHiddenInputs filters={data.filters} />
                    <Checkbox
                      name="notifyOnNewMatches"
                      label="Use for notifications"
                      defaultChecked={
                        data.savedFilters?.notifyOnNewMatches ?? false
                      }
                      pb={8}
                    />
                    <Button
                      type="submit"
                      variant="default"
                      loading={preferenceSubmitting}
                    >
                      Save applied filters
                    </Button>
                  </Group>
                </preferenceFetcher.Form>
              ) : null}
              {activeFilterCount > 0 ? (
                <Button component={Link} to="/dashboard/days" variant="subtle">
                  Clear filters
                </Button>
              ) : null}
            </Group>
          </Group>

          {data.savedFilters && savedFilterHref ? (
            <Paper withBorder p="sm" radius="md">
              <Group justify="space-between" gap="md" align="center">
                <Stack gap={2}>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={700}>Saved view</Text>
                    <Badge variant="light" color="brand">
                      {savedFilterCount}{' '}
                      {savedFilterCount === 1 ? 'filter' : 'filters'}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {formatSavedFilterSummary(
                      data.savedFilters,
                      data.seriesOptions,
                    )}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Notifications{' '}
                    {data.savedFilters.notifyOnNewMatches
                      ? 'limited to this saved view'
                      : 'off'}
                  </Text>
                </Stack>
                <Group gap="xs" justify="flex-end">
                  <Button
                    component={Link}
                    to={savedFilterHref}
                    variant="light"
                    color="brand"
                  >
                    Apply saved view
                  </Button>
                  <preferenceFetcher.Form
                    method="post"
                    aria-label="Clear saved filters"
                  >
                    <input
                      type="hidden"
                      name="intent"
                      value="clearSavedDaysFilters"
                    />
                    <Button
                      type="submit"
                      variant="subtle"
                      color="gray"
                      loading={preferenceSubmitting}
                    >
                      Clear saved
                    </Button>
                  </preferenceFetcher.Form>
                </Group>
              </Group>
            </Paper>
          ) : null}

          {preferenceMessage ? (
            <Text
              size="sm"
              c={preferenceFetcher.data?.ok ? 'dimmed' : 'red'}
              fw={700}
            >
              {preferenceMessage}
            </Text>
          ) : null}

          <Form method="get" aria-label="Available days filters">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} spacing="md">
                <Select
                  name="month"
                  label="Month"
                  placeholder="Any month"
                  data={data.monthOptions.map((value) => ({
                    value,
                    label: formatMonthOption(value),
                  }))}
                  defaultValue={data.filters.month}
                  clearable
                />
                <Select
                  name="series"
                  label="Race series"
                  placeholder="Any series"
                  data={data.seriesOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  value={selectedSeries}
                  onChange={(value) => setSelectedSeries(value ?? '')}
                  clearable
                  searchable
                  nothingFoundMessage="No series found"
                />
                <MultiSelect
                  label="Circuit"
                  placeholder={
                    selectedCircuits.length > 0 ? undefined : 'Any circuit'
                  }
                  data={circuitOptionsForSelectedSeries}
                  value={selectedCircuits}
                  onChange={setSelectedCircuits}
                  searchable
                  clearable
                  nothingFoundMessage="No circuits found"
                />
                {selectedCircuits.map((circuit) => (
                  <input
                    key={circuit}
                    type="hidden"
                    name="circuit"
                    value={circuit}
                  />
                ))}
                <Select
                  name="provider"
                  label="Provider"
                  placeholder="Any provider"
                  data={data.providerOptions}
                  defaultValue={data.filters.provider}
                  clearable
                />
                <Select
                  name="type"
                  label="Type"
                  placeholder="Any type"
                  data={[
                    { value: 'race_day', label: 'Race day' },
                    { value: 'test_day', label: 'Test day' },
                    { value: 'track_day', label: 'Track day' },
                    { value: 'road_drive', label: 'Road drive' },
                  ]}
                  defaultValue={data.filters.type}
                  clearable
                />
              </SimpleGrid>

              <Group justify="flex-end">
                <Button type="submit">Apply filters</Button>
              </Group>
            </Stack>
          </Form>
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>
                {selectedDayFromUrl ? 'Selected day' : 'Choose a day'}
              </Title>
              <Text size="sm" c="dimmed">
                {selectedDayFromUrl
                  ? selectedDayPosition
                    ? `${selectedDayPosition} of ${loadedDays.totalCount} matching days`
                    : `Showing ${orderedLoadedDays.length} of ${loadedDays.totalCount} matching days`
                  : 'Scan the live feed, then open one day at a time to inspect the group plan and add it to your bookings.'}
              </Text>
            </Stack>
            {selectedDayFromUrl ? (
              <Group gap="xs" wrap="wrap" justify="flex-end">
                {previousSelectedDay ? (
                  <Button
                    component={Link}
                    to={createDaysIndexHref(
                      data.filters,
                      previousSelectedDay.dayId,
                      hasLoadedFullSet ? null : previousSelectedDay.dayId,
                    )}
                    variant="default"
                    preventScrollReset
                  >
                    Previous
                  </Button>
                ) : (
                  <Button variant="default" disabled>
                    Previous
                  </Button>
                )}
                {nextSelectedDay ? (
                  <Button
                    component={Link}
                    to={createDaysIndexHref(
                      data.filters,
                      nextSelectedDay.dayId,
                      hasLoadedFullSet ? null : nextSelectedDay.dayId,
                    )}
                    variant="default"
                    preventScrollReset
                  >
                    Next
                  </Button>
                ) : (
                  <Button variant="default" disabled>
                    Next
                  </Button>
                )}
                <Button
                  component={Link}
                  to={createDaysIndexHref(data.filters)}
                  variant="default"
                  preventScrollReset
                >
                  Back to available days
                </Button>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Showing {loadedDays.days.length} of {loadedDays.totalCount} days
              </Text>
            )}
          </Group>

          {selectedDayFromUrl ? (
            <DayDetailPanel
              day={selectedDayFromUrl}
              summary={getAttendanceSummary(
                loadedDays.attendanceSummaries,
                selectedDayFromUrl.dayId,
              )}
              booking={loadedDays.myBookingsByDay[selectedDayFromUrl.dayId]}
              series={selectedDaySeries ?? undefined}
              sharedPlan={
                selectedDayMatchesRouteData ? data.selectedDayPlan : null
              }
              costSummary={selectedDayCostSummary}
              costLoading={costLoading}
              currentUser={data.currentUser}
              attendanceDetails={selectedDayAttendanceDetails}
              attendanceLoading={attendanceLoading}
            />
          ) : loadedDays.days.length > 0 ? (
            <DayListPanel
              days={loadedDays.days}
              filters={data.filters}
              attendanceSummaries={loadedDays.attendanceSummaries}
              myBookingsByDay={loadedDays.myBookingsByDay}
              selectedDayId={null}
            />
          ) : (
            <EmptyStateCard
              title="No days match those filters"
              description="Reset the selection or widen the feed to bring more race, test, and track dates back into view."
              action={
                <Button component={Link} to="/dashboard/days">
                  Show the full feed
                </Button>
              }
            />
          )}

          {!selectedDayFromUrl && loadedDays.nextOffset !== null ? (
            <Box>
              <Stack gap={4} align="center">
                {feedFetcher.state === 'idle' ? (
                  <Text size="sm" c="dimmed">
                    Scroll to load more
                  </Text>
                ) : (
                  <Loader size="sm" color="brand" />
                )}
                <div ref={loadMoreRef} style={{ height: 1 }} />
              </Stack>
            </Box>
          ) : loadedDays.totalCount > 0 ? (
            <Text size="sm" c="dimmed" ta="center">
              All matching days are loaded.
            </Text>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
