import {
  Alert,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconBuildingSkyscraper,
  IconClock,
  IconLock,
  IconMapPin,
  IconRoad,
  IconSearch,
  IconSparkles,
  IconStar,
  IconUsers,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import { TripStatusSummary } from '~/components/layout/trip-status-summary';
import type {
  BookingEditorActionResult,
  HotelReviewActionResult,
} from '~/lib/bookings/actions.server';
import {
  formatArrivalDateTime,
  resolveArrivalDateTime,
} from '~/lib/dates/arrival';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import type { UserGarageShareRequest } from '~/lib/db/services/garage-sharing.server';
import type {
  HotelInsight,
  HotelSuggestion,
} from '~/lib/db/services/hotel.server';
import type { GarageShareDecisionActionResult } from '~/lib/garage-sharing/actions.server';

export interface MyBookingsPageProps {
  bookings: BookingRecord[];
  garageShareRequests?: UserGarageShareRequest[];
  hotelInsights?: Record<string, HotelInsight>;
}

type BookingFilter = 'all' | BookingRecord['status'];

interface HotelSearchResponse {
  suggestions: HotelSuggestion[];
  providerAvailable: boolean;
  providerError: string | null;
}

function hotelFromBooking(booking: BookingRecord): HotelSuggestion | null {
  if (!booking.accommodationName?.trim()) {
    return null;
  }

  return {
    hotelId: booking.hotelId,
    name: booking.accommodationName.trim(),
    source: 'manual',
  };
}

function hotelFromInsight(insight?: HotelInsight): HotelSuggestion | null {
  if (!insight) {
    return null;
  }

  return {
    hotelId: insight.hotel.hotelId,
    name: insight.hotel.name,
    address: insight.hotel.address,
    postcode: insight.hotel.postcode,
    country: insight.hotel.country,
    latitude: insight.hotel.latitude,
    longitude: insight.hotel.longitude,
    source: insight.hotel.source,
    sourcePlaceId: insight.hotel.sourcePlaceId,
    attribution: insight.hotel.attribution,
  };
}

function getHotelAddressLine(hotel?: HotelSuggestion | null) {
  return [hotel?.address, hotel?.postcode].filter(Boolean).join(' • ');
}

function getRatingLabel(value?: number) {
  return value ? `${value}/5` : 'No rating yet';
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bookingColor(status: BookingRecord['status']) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

function bookingSharedSummary(booking: BookingRecord) {
  const arrivalDateTime = resolveArrivalDateTime(booking);
  const parts = [
    booking.accommodationName,
    arrivalDateTime
      ? `Arriving ${formatArrivalDateTime(arrivalDateTime)}`
      : undefined,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) {
    return parts.join(' • ');
  }

  if (booking.status === 'cancelled') {
    return 'No shared stay on this trip';
  }

  return 'No accommodation shared yet';
}

function bookingPrivateSummary(booking: BookingRecord) {
  if (booking.bookingReference) {
    return `Reference ${booking.bookingReference}`;
  }

  if (booking.notes) {
    return 'Private notes saved';
  }

  return 'No private references yet';
}

function bookingGarageSummary(booking: BookingRecord) {
  if (!booking.garageBooked) {
    return 'No garage shared yet';
  }

  const capacity = booking.garageCapacity ?? 2;
  const label = booking.garageLabel?.trim();
  return label ? `${label} • ${capacity} cars` : `Garage • ${capacity} cars`;
}

function garageRequestStatusColor(status: UserGarageShareRequest['status']) {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'approved':
      return 'green';
    case 'declined':
      return 'gray';
    case 'cancelled':
      return 'gray';
  }
}

function BookingFieldLabel({
  label,
  visibility,
  visibilityColor = 'dimmed',
}: {
  label: string;
  visibility: string;
  visibilityColor?: string;
}) {
  return (
    <Group gap={6} wrap="wrap" align="center">
      <Text span fw={700} size="sm">
        {label}
      </Text>
      <Text span size="xs" c={visibilityColor}>
        {visibility}
      </Text>
    </Group>
  );
}

function BookingSectionHeading({
  icon,
  title,
  description,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Stack gap={2}>
      <Group gap="xs" align="center">
        <ThemeIcon size={28} radius="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Text fw={700}>{title}</Text>
      </Group>
      <Text size="sm" c="dimmed">
        {description}
      </Text>
    </Stack>
  );
}

function formatBookingDate(date: string) {
  return formatDateOnly(date, {
    day: 'numeric',
    month: 'short',
  });
}

function formatBookingMonth(date: string) {
  return formatDateOnly(date, {
    month: 'long',
    year: 'numeric',
  });
}

function sortBookings(a: BookingRecord, b: BookingRecord) {
  if (a.status === 'cancelled' && b.status !== 'cancelled') {
    return 1;
  }

  if (b.status === 'cancelled' && a.status !== 'cancelled') {
    return -1;
  }

  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return a.circuit.localeCompare(b.circuit);
}

function matchesBookingQuery(booking: BookingRecord, query: string) {
  if (!query) {
    return true;
  }

  const value = query.toLowerCase();
  return [
    booking.circuit,
    booking.provider,
    booking.date,
    booking.description,
    booking.accommodationName,
    resolveArrivalDateTime(booking),
    booking.garageLabel,
    booking.bookingReference,
  ].some((field) => field?.toLowerCase().includes(value));
}

function groupBookingsByMonth(bookings: BookingRecord[]) {
  const groups = new Map<string, BookingRecord[]>();

  for (const booking of bookings) {
    const label = formatBookingMonth(booking.date);
    const current = groups.get(label);
    if (current) {
      current.push(booking);
      continue;
    }

    groups.set(label, [booking]);
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function BookingListItem({
  booking,
  active,
  onSelect,
}: {
  booking: BookingRecord;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <UnstyledButton
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="booking-list-item"
      data-active={active || undefined}
    >
      <div className="booking-list-item-grid">
        <Stack gap={4} className="booking-list-date">
          <Text size="sm" fw={800}>
            {formatBookingDate(booking.date)}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {booking.provider}
          </Text>
        </Stack>
        <Text className="booking-list-title" fw={700} lineClamp={1}>
          {booking.circuit}
        </Text>
        <Badge
          className="booking-list-badge"
          color={bookingColor(booking.status)}
          size="sm"
        >
          {titleCase(booking.status)}
        </Badge>
        <Text className="booking-list-shared" size="sm" lineClamp={1}>
          <Text span className="booking-list-kicker">
            Shared
          </Text>{' '}
          {bookingSharedSummary(booking)} • {bookingGarageSummary(booking)}
        </Text>
        <Text
          className="booking-list-private"
          size="xs"
          c="dimmed"
          lineClamp={1}
        >
          <Text
            span
            className="booking-list-kicker booking-list-kicker-private"
          >
            Private
          </Text>{' '}
          {bookingPrivateSummary(booking)}
        </Text>
      </div>
    </UnstyledButton>
  );
}

function GarageShareRequestList({
  title,
  emptyText,
  requests,
}: {
  title: string;
  emptyText: string;
  requests: UserGarageShareRequest[];
}) {
  const fetcher = useFetcher<GarageShareDecisionActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const submitStatus = (
    request: UserGarageShareRequest,
    status: 'approved' | 'declined' | 'cancelled',
  ) => {
    fetcher.submit(
      {
        intent: 'updateGarageShareRequest',
        requestId: request.requestId,
        status,
      },
      { method: 'post' },
    );
  };

  return (
    <Stack gap="xs">
      <Text fw={700}>{title}</Text>
      {formError ? (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {formError}
        </Alert>
      ) : null}
      {requests.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyText}
        </Text>
      ) : (
        <Stack gap="xs">
          {requests.map((request) => (
            <Paper key={request.requestId} withBorder p="sm" radius="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <Stack gap={4}>
                  <Group gap="xs" wrap="wrap">
                    <Text size="sm" fw={700}>
                      {request.isIncoming
                        ? request.requesterName
                        : request.garageOwnerName}
                    </Text>
                    <Badge
                      color={garageRequestStatusColor(request.status)}
                      variant="light"
                    >
                      {titleCase(request.status)}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {request.circuit} • {request.provider}
                  </Text>
                </Stack>

                {request.isIncoming && request.status === 'pending' ? (
                  <Group gap="xs" justify="flex-end">
                    <Button
                      type="button"
                      size="compact-sm"
                      variant="default"
                      disabled={isSubmitting}
                      onClick={() => submitStatus(request, 'declined')}
                    >
                      Decline
                    </Button>
                    <Button
                      type="button"
                      size="compact-sm"
                      loading={isSubmitting}
                      onClick={() => submitStatus(request, 'approved')}
                    >
                      Approve
                    </Button>
                  </Group>
                ) : request.status === 'pending' ||
                  request.status === 'approved' ? (
                  <Button
                    type="button"
                    size="compact-sm"
                    variant="default"
                    loading={isSubmitting}
                    onClick={() => submitStatus(request, 'cancelled')}
                  >
                    Cancel
                  </Button>
                ) : null}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function HotelSelector({
  booking,
  insight,
  fieldErrors,
}: {
  booking: BookingRecord;
  insight?: HotelInsight;
  fieldErrors?: Partial<
    Record<
      | 'accommodationName'
      | 'hotelId'
      | 'hotelName'
      | 'hotelAddress'
      | 'hotelPostcode'
      | 'hotelCountry'
      | 'hotelLatitude'
      | 'hotelLongitude'
      | 'hotelSource'
      | 'hotelSourcePlaceId'
      | 'hotelAttribution',
      string[] | undefined
    >
  >;
}) {
  const initialHotel = hotelFromInsight(insight) ?? hotelFromBooking(booking);
  const [searchOpened, { close: closeSearch, open: openSearch }] =
    useDisclosure(false);
  const searchFetcher = useFetcher<HotelSearchResponse>();
  const [query, setQuery] = useState(booking.accommodationName ?? '');
  const [selectedHotel, setSelectedHotel] = useState<HotelSuggestion | null>(
    initialHotel,
  );
  const [hotelName, setHotelName] = useState(initialHotel?.name ?? '');
  const [hotelAddress, setHotelAddress] = useState(
    getHotelAddressLine(initialHotel),
  );

  const searchResults = searchFetcher.data?.suggestions ?? [];
  const isSearching = searchFetcher.state !== 'idle';
  const providerError = searchFetcher.data?.providerError;
  const hotelSource = selectedHotel?.source ?? 'manual';

  const runSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    searchFetcher.load(`/api/hotels/search?q=${encodeURIComponent(trimmed)}`);
  };

  const selectHotel = (hotel: HotelSuggestion) => {
    setSelectedHotel(hotel);
    setHotelName(hotel.name);
    setHotelAddress(getHotelAddressLine(hotel));
    setQuery(hotel.name);
    closeSearch();
  };

  const clearSelectedHotel = () => {
    setSelectedHotel(null);
  };

  return (
    <>
      <Modal opened={searchOpened} onClose={closeSearch} title="Find hotel">
        <Stack gap="md">
          <Group align="flex-end" gap="sm">
            <TextInput
              label="Hotel search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runSearch();
                }
              }}
              leftSection={<IconSearch size={16} />}
              placeholder="Radisson Blu East Midlands"
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              onClick={runSearch}
              loading={isSearching}
              disabled={query.trim().length < 2}
            >
              Search
            </Button>
          </Group>

          {providerError ? (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
              Hotel lookup is not available right now. You can still add the
              hotel manually.
            </Alert>
          ) : null}

          {searchResults.length > 0 ? (
            <Stack gap="xs">
              {searchResults.map((hotel) => (
                <UnstyledButton
                  key={[
                    hotel.hotelId,
                    hotel.source,
                    hotel.sourcePlaceId,
                    hotel.name,
                  ].join(':')}
                  type="button"
                  className="hotel-search-result"
                  onClick={() => selectHotel(hotel)}
                >
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <ThemeIcon
                      size={32}
                      radius="sm"
                      color="blue"
                      variant="light"
                    >
                      <IconBuildingSkyscraper size={18} />
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={700}>{hotel.name}</Text>
                      {getHotelAddressLine(hotel) ? (
                        <Text size="sm" c="dimmed">
                          {getHotelAddressLine(hotel)}
                        </Text>
                      ) : null}
                      <Badge size="xs" variant="light">
                        {hotel.hotelId ? 'Grid Stay hotel' : 'Geoapify result'}
                      </Badge>
                    </Stack>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          ) : searchFetcher.data ? (
            <Text size="sm" c="dimmed">
              No hotel lookup matches yet. Add the hotel manually below.
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Search by hotel name, then pick the matching address.
            </Text>
          )}

          <Group justify="space-between" wrap="wrap">
            <Text size="xs" c="dimmed">
              Hotel data powered by Geoapify. © OpenStreetMap contributors.
            </Text>
            <Button
              type="button"
              variant="default"
              onClick={() => {
                clearSelectedHotel();
                closeSearch();
              }}
            >
              Add manually
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap="sm">
        <input
          type="hidden"
          name="hotelId"
          value={selectedHotel?.hotelId ?? ''}
        />
        <input type="hidden" name="hotelName" value={hotelName} />
        <input type="hidden" name="hotelSource" value={hotelSource} />
        <input
          type="hidden"
          name="hotelSourcePlaceId"
          value={selectedHotel?.sourcePlaceId ?? ''}
        />
        <input
          type="hidden"
          name="hotelPostcode"
          value={selectedHotel?.postcode ?? ''}
        />
        <input
          type="hidden"
          name="hotelCountry"
          value={selectedHotel?.country ?? ''}
        />
        <input
          type="hidden"
          name="hotelLatitude"
          value={selectedHotel?.latitude ?? ''}
        />
        <input
          type="hidden"
          name="hotelLongitude"
          value={selectedHotel?.longitude ?? ''}
        />
        <input
          type="hidden"
          name="hotelAttribution"
          value={selectedHotel?.attribution ?? ''}
        />

        <TextInput
          name="accommodationName"
          label={
            <BookingFieldLabel
              label="Hotel or stay"
              visibility="Visible to the group"
              visibilityColor="blue.6"
            />
          }
          description="Search for a hotel with address details, or type a stay name manually."
          value={hotelName}
          onChange={(event) => {
            setHotelName(event.currentTarget.value);
            clearSelectedHotel();
          }}
          error={
            fieldErrors?.accommodationName?.[0] ??
            fieldErrors?.hotelName?.[0] ??
            fieldErrors?.hotelId?.[0]
          }
          maxLength={120}
          rightSectionWidth={112}
          rightSection={
            <Button type="button" size="compact-xs" onClick={openSearch}>
              Find hotel
            </Button>
          }
        />

        <TextInput
          name="hotelAddress"
          label="Address"
          description="Optional, but useful once the hotel is in the shared catalogue."
          value={hotelAddress}
          onChange={(event) => setHotelAddress(event.currentTarget.value)}
          error={fieldErrors?.hotelAddress?.[0]}
          maxLength={240}
          leftSection={<IconMapPin size={16} />}
        />

        {selectedHotel ? (
          <Paper withBorder p="sm" radius="md">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={32} radius="sm" color="blue" variant="light">
                <IconBuildingSkyscraper size={18} />
              </ThemeIcon>
              <Stack gap={2}>
                <Group gap="xs" wrap="wrap">
                  <Text size="sm" fw={700}>
                    {selectedHotel.name}
                  </Text>
                  <Badge size="xs" color="blue" variant="light">
                    {selectedHotel.hotelId ? 'Saved hotel' : 'Will be saved'}
                  </Badge>
                </Group>
                {hotelAddress ? (
                  <Text size="sm" c="dimmed">
                    {hotelAddress}
                  </Text>
                ) : null}
                {selectedHotel.attribution ? (
                  <Text size="xs" c="dimmed">
                    {selectedHotel.attribution}
                  </Text>
                ) : null}
              </Stack>
            </Group>
          </Paper>
        ) : null}
      </Stack>
    </>
  );
}

function HotelFeedbackPanel({
  booking,
  insight,
}: {
  booking: BookingRecord;
  insight?: HotelInsight;
}) {
  const reviewFetcher = useFetcher<HotelReviewActionResult>();
  const isSavingReview = reviewFetcher.state !== 'idle';
  const formError =
    reviewFetcher.data && !reviewFetcher.data.ok
      ? reviewFetcher.data.formError
      : null;
  const fieldErrors =
    reviewFetcher.data && !reviewFetcher.data.ok
      ? reviewFetcher.data.fieldErrors
      : undefined;
  const myReview = insight?.reviews.find(
    (review) => review.userId === booking.userId,
  );

  return (
    <Paper
      className="shell-card booking-editor-panel"
      p={{ base: 'md', sm: 'lg' }}
    >
      <Stack gap="md">
        <BookingSectionHeading
          icon={<IconSparkles size={16} />}
          title="Hotel feedback"
          description="Capture the details that matter to the group, especially parking and arrival logistics."
          color="blue"
        />

        {!booking.hotelId || !insight ? (
          <Alert color="blue" icon={<IconBuildingSkyscraper size={18} />}>
            Save a hotel from the stay section first, then add parking and
            arrival feedback for the group.
          </Alert>
        ) : (
          <>
            <Paper withBorder p="sm" radius="md">
              <Group justify="space-between" align="flex-start" gap="md">
                <Stack gap={4}>
                  <Text fw={700}>{insight.hotel.name}</Text>
                  {insight.hotel.address ? (
                    <Text size="sm" c="dimmed">
                      {insight.hotel.address}
                    </Text>
                  ) : null}
                  <Text size="sm">{insight.summary}</Text>
                  <Badge size="xs" variant="light" color="blue">
                    {insight.summarySource === 'bedrock'
                      ? 'AI summary'
                      : 'Review summary'}
                  </Badge>
                </Stack>
                <Stack gap={2} align="flex-end">
                  <Group gap={4}>
                    <IconStar size={16} />
                    <Text fw={700}>
                      {getRatingLabel(insight.averageRating)}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {insight.reviewCount}{' '}
                    {insight.reviewCount === 1 ? 'review' : 'reviews'}
                  </Text>
                </Stack>
              </Group>
            </Paper>

            <reviewFetcher.Form method="post">
              <input type="hidden" name="intent" value="saveHotelReview" />
              <input type="hidden" name="hotelId" value={booking.hotelId} />
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <NumberInput
                    name="rating"
                    label="Overall rating"
                    description="Optional group usefulness rating."
                    min={1}
                    max={5}
                    defaultValue={myReview?.rating}
                    error={fieldErrors?.rating?.[0]}
                  />
                  <Select
                    name="trailerParking"
                    label="Trailer parking"
                    defaultValue={myReview?.trailerParking ?? 'unknown'}
                    data={[
                      { value: 'unknown', label: 'Not sure' },
                      { value: 'good', label: 'Good' },
                      { value: 'limited', label: 'Limited' },
                      { value: 'none', label: 'None' },
                    ]}
                    error={fieldErrors?.trailerParking?.[0]}
                  />
                  <Select
                    name="secureParking"
                    label="Secure parking"
                    defaultValue={myReview?.secureParking ?? 'unknown'}
                    data={[
                      { value: 'unknown', label: 'Not sure' },
                      { value: 'yes', label: 'Yes' },
                      { value: 'mixed', label: 'Mixed' },
                      { value: 'no', label: 'No' },
                    ]}
                    error={fieldErrors?.secureParking?.[0]}
                  />
                  <Select
                    name="lateCheckIn"
                    label="Late check-in"
                    defaultValue={myReview?.lateCheckIn ?? 'unknown'}
                    data={[
                      { value: 'unknown', label: 'Not sure' },
                      { value: 'yes', label: 'Yes' },
                      { value: 'limited', label: 'Limited' },
                      { value: 'no', label: 'No' },
                    ]}
                    error={fieldErrors?.lateCheckIn?.[0]}
                  />
                </SimpleGrid>

                <Textarea
                  name="parkingNotes"
                  label="Parking notes"
                  description="Trailer room, car park access, lighting, barriers, or anything awkward."
                  minRows={2}
                  defaultValue={myReview?.parkingNotes ?? ''}
                  error={fieldErrors?.parkingNotes?.[0]}
                  maxLength={500}
                />
                <Textarea
                  name="generalNotes"
                  label="General hotel notes"
                  description="Food, check-in, noise, distance to circuit, or other group-relevant notes."
                  minRows={3}
                  defaultValue={myReview?.generalNotes ?? ''}
                  error={fieldErrors?.generalNotes?.[0]}
                  maxLength={1000}
                />

                {formError ? (
                  <Alert color="red" icon={<IconAlertCircle size={18} />}>
                    {formError}
                  </Alert>
                ) : null}

                <Group justify="flex-end">
                  <Button
                    type="submit"
                    name="intent"
                    value="saveHotelReview"
                    loading={isSavingReview}
                  >
                    Save hotel feedback
                  </Button>
                </Group>
              </Stack>
            </reviewFetcher.Form>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function BookingEditorPanel({
  booking,
  hotelInsight,
  garageShareRequests,
  selectedIndex,
  totalBookings,
  hasPrevious,
  hasNext,
  onSelectPrevious,
  onSelectNext,
}: {
  booking: BookingRecord;
  hotelInsight?: HotelInsight;
  selectedIndex: number;
  totalBookings: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
  garageShareRequests: UserGarageShareRequest[];
}) {
  const [
    deleteModalOpened,
    { close: closeDeleteModal, open: openDeleteModal },
  ] = useDisclosure(false);
  const saveFetcher = useFetcher<BookingEditorActionResult>();
  const deleteFetcher = useFetcher<BookingEditorActionResult>();
  const isSaving = saveFetcher.state !== 'idle';
  const isDeleting = deleteFetcher.state !== 'idle';
  const arrivalDateTime = resolveArrivalDateTime(booking);
  const fieldErrors =
    saveFetcher.data && !saveFetcher.data.ok
      ? saveFetcher.data.fieldErrors
      : undefined;
  const formError =
    saveFetcher.data && !saveFetcher.data.ok
      ? saveFetcher.data.formError
      : null;
  const deleteFormError =
    deleteFetcher.data && !deleteFetcher.data.ok
      ? deleteFetcher.data.formError
      : null;
  const incomingGarageRequests = garageShareRequests.filter(
    (request) =>
      request.isIncoming &&
      request.dayId === booking.dayId &&
      request.garageBookingId === booking.bookingId,
  );
  const outgoingGarageRequests = garageShareRequests.filter(
    (request) =>
      request.isOutgoing &&
      (request.requesterBookingId === booking.bookingId ||
        request.dayId === booking.dayId),
  );

  useEffect(() => {
    if (deleteFetcher.state === 'idle' && deleteFetcher.data?.ok) {
      closeDeleteModal();
    }
  }, [closeDeleteModal, deleteFetcher.data, deleteFetcher.state]);

  return (
    <>
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Delete booking?"
        centered
      >
        <deleteFetcher.Form method="post">
          <input type="hidden" name="bookingId" value={booking.bookingId} />
          <input type="hidden" name="intent" value="deleteBooking" />
          <Stack gap="md">
            <Text size="sm">
              This removes {booking.circuit} from your trips and updates the
              shared attendance for that day.
            </Text>

            {deleteFormError ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                {deleteFormError}
              </Alert>
            ) : null}

            <Group justify="flex-end" wrap="wrap">
              <Button
                type="button"
                variant="default"
                onClick={closeDeleteModal}
              >
                Cancel
              </Button>
              <Button type="submit" color="red" loading={isDeleting}>
                Delete booking
              </Button>
            </Group>
          </Stack>
        </deleteFetcher.Form>
      </Modal>

      <Paper
        className="shell-card booking-editor-panel"
        p={{ base: 'md', sm: 'lg' }}
      >
        <saveFetcher.Form method="post">
          <input type="hidden" name="bookingId" value={booking.bookingId} />
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text size="sm" fw={700} c="brand.7">
                  Editing trip {selectedIndex + 1} of {totalBookings}
                </Text>
                <Title order={2}>{booking.circuit}</Title>
                <Text size="sm" c="dimmed">
                  {booking.date} • {booking.provider}
                </Text>
                <Text size="sm">
                  {booking.description || 'No extra details'}
                </Text>
              </Stack>
              <Stack gap="sm" align="flex-end">
                <Badge color={bookingColor(booking.status)} size="lg">
                  {titleCase(booking.status)}
                </Badge>
                <Group gap="xs">
                  <Button
                    type="button"
                    size="compact-sm"
                    variant="default"
                    onClick={onSelectPrevious}
                    disabled={!hasPrevious}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="compact-sm"
                    variant="default"
                    onClick={onSelectNext}
                    disabled={!hasNext}
                  >
                    Next
                  </Button>
                </Group>
              </Stack>
            </Group>

            <Divider />

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="xl">
              <Stack gap="md" className="booking-editor-section">
                <BookingSectionHeading
                  icon={<IconRoad size={16} />}
                  title="Trip plan"
                  description="Keep the status current before you lock in the rest of the trip."
                  color="brand"
                />
                <Select
                  name="status"
                  label={
                    <BookingFieldLabel
                      label="Status"
                      visibility="Affects your trip plan"
                      visibilityColor="brand.7"
                    />
                  }
                  description="Use booked, maybe, or cancelled to keep this trip current."
                  defaultValue={booking.status}
                  data={[
                    { value: 'booked', label: 'Booked' },
                    { value: 'maybe', label: 'Maybe' },
                    { value: 'cancelled', label: 'Cancelled' },
                  ]}
                  error={fieldErrors?.status?.[0]}
                />
              </Stack>

              <Stack gap="md" className="booking-editor-section">
                <BookingSectionHeading
                  icon={<IconUsers size={16} />}
                  title="Shared with the group"
                  description="The hotel or stay and arrival time are visible to everyone coordinating this day."
                  color="blue"
                />
                <HotelSelector
                  booking={booking}
                  insight={hotelInsight}
                  fieldErrors={fieldErrors}
                />
                <DateTimePicker
                  name="arrivalDateTime"
                  label={
                    <BookingFieldLabel
                      label="Arrival"
                      visibility="Visible to the group"
                      visibilityColor="blue.6"
                    />
                  }
                  leftSection={<IconClock size={16} />}
                  description="Optional paddock or venue arrival date and time."
                  valueFormat="ddd D MMM YYYY, HH:mm"
                  defaultValue={arrivalDateTime}
                  defaultDate={arrivalDateTime ?? booking.date}
                  defaultTimeValue="19:00"
                  clearable
                  error={fieldErrors?.arrivalDateTime?.[0]}
                />
                <Text size="sm" c="dimmed">
                  Add only details you are happy for other members to see.
                </Text>
              </Stack>
            </SimpleGrid>

            <Stack gap="md" className="booking-editor-section">
              <BookingSectionHeading
                icon={<IconUsers size={16} />}
                title="Garage sharing"
                description="Garage availability is visible to active attendees for this day."
                color="orange"
              />
              <Switch
                name="garageBooked"
                value="true"
                label={
                  <BookingFieldLabel
                    label="Garage booked"
                    visibility="Visible to the group"
                    visibilityColor="orange.7"
                  />
                }
                description="Turn this on when you have a garage and can share spare space."
                defaultChecked={Boolean(booking.garageBooked)}
              />
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <NumberInput
                  name="garageCapacity"
                  label={
                    <BookingFieldLabel
                      label="Garage capacity"
                      visibility="Includes your car"
                      visibilityColor="orange.7"
                    />
                  }
                  description="Most garages hold two cars."
                  defaultValue={booking.garageCapacity ?? 2}
                  min={1}
                  max={20}
                  error={fieldErrors?.garageCapacity?.[0]}
                />
                <TextInput
                  name="garageLabel"
                  label={
                    <BookingFieldLabel
                      label="Garage label"
                      visibility="Visible to the group"
                      visibilityColor="orange.7"
                    />
                  }
                  description="Optional garage number, block, or note."
                  defaultValue={booking.garageLabel ?? ''}
                  error={fieldErrors?.garageLabel?.[0]}
                  maxLength={120}
                />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <GarageShareRequestList
                  title="Requests to my garage"
                  emptyText="No one has asked to share this garage yet."
                  requests={incomingGarageRequests}
                />
                <GarageShareRequestList
                  title="My garage requests"
                  emptyText="You have not asked to share another garage for this trip."
                  requests={outgoingGarageRequests}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="md" className="booking-editor-section">
              <BookingSectionHeading
                icon={<IconLock size={16} />}
                title="Private to you"
                description="References and notes stay on your side and do not appear in the shared plan."
                color="gray"
              />
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <TextInput
                  name="bookingReference"
                  label={
                    <BookingFieldLabel
                      label="Booking reference"
                      visibility="Visible only to you"
                    />
                  }
                  description="Store the confirmation code or internal reference here."
                  defaultValue={booking.bookingReference ?? ''}
                  error={fieldErrors?.bookingReference?.[0]}
                  maxLength={120}
                />
                <TextInput
                  name="accommodationReference"
                  label={
                    <BookingFieldLabel
                      label="Accommodation reference"
                      visibility="Visible only to you"
                    />
                  }
                  description="Useful for the hotel confirmation, booking id, or door code."
                  defaultValue={booking.accommodationReference ?? ''}
                  error={fieldErrors?.accommodationReference?.[0]}
                  maxLength={120}
                />
              </SimpleGrid>

              <Textarea
                name="notes"
                label={
                  <BookingFieldLabel
                    label="Private notes"
                    visibility="Visible only to you"
                  />
                }
                description="Keep reminders or anything else you do not want in the shared plan."
                minRows={4}
                defaultValue={booking.notes ?? ''}
                error={fieldErrors?.notes?.[0]}
                maxLength={1000}
              />
            </Stack>

            {formError ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                {formError}
              </Alert>
            ) : null}

            <Group justify="space-between" wrap="wrap">
              <Button
                type="button"
                color="red"
                variant="subtle"
                onClick={openDeleteModal}
              >
                Delete booking
              </Button>
              <Button
                type="submit"
                name="intent"
                value="updateBooking"
                loading={isSaving}
              >
                Save changes
              </Button>
            </Group>
          </Stack>
        </saveFetcher.Form>
      </Paper>
      <HotelFeedbackPanel booking={booking} insight={hotelInsight} />
    </>
  );
}

export function MyBookingsPage({
  bookings,
  garageShareRequests = [],
  hotelInsights = {},
}: MyBookingsPageProps) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    bookings[0]?.bookingId ?? null,
  );
  const [statusFilter, setStatusFilter] = useState<BookingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const bookedCount = bookings.filter(
    (booking) => booking.status === 'booked',
  ).length;
  const maybeCount = bookings.filter(
    (booking) => booking.status === 'maybe',
  ).length;
  const sharedStayCount = new Set(
    bookings
      .map((booking) => booking.accommodationName?.trim())
      .filter((name): name is string => Boolean(name)),
  ).size;
  const sortedBookings = useMemo(
    () => [...bookings].sort(sortBookings),
    [bookings],
  );
  const filteredBookings = useMemo(
    () =>
      sortedBookings.filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) {
          return false;
        }

        return matchesBookingQuery(booking, searchQuery.trim());
      }),
    [searchQuery, sortedBookings, statusFilter],
  );
  const bookingSections = useMemo(
    () => groupBookingsByMonth(filteredBookings),
    [filteredBookings],
  );
  const selectedBooking = useMemo(
    () =>
      filteredBookings.find(
        (booking) => booking.bookingId === selectedBookingId,
      ) ??
      filteredBookings[0] ??
      null,
    [filteredBookings, selectedBookingId],
  );
  const selectedIndex = selectedBooking
    ? filteredBookings.findIndex(
        (booking) => booking.bookingId === selectedBooking.bookingId,
      )
    : -1;

  useEffect(() => {
    if (filteredBookings.length === 0) {
      setSelectedBookingId(null);
      return;
    }

    if (
      selectedBookingId &&
      filteredBookings.some(
        (booking) => booking.bookingId === selectedBookingId,
      )
    ) {
      return;
    }

    setSelectedBookingId(filteredBookings[0].bookingId);
  }, [filteredBookings, selectedBookingId]);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Private trip details"
        title="My Bookings"
        description="Keep shared stay names aligned with the group while references and notes stay on your side."
        meta={
          <TripStatusSummary
            totalCount={bookings.length}
            confirmedCount={bookedCount}
            maybeCount={maybeCount}
            sharedStayCount={sharedStayCount}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/days" variant="default">
            Back to available days
          </Button>
        }
      />

      {bookings.length === 0 ? (
        <EmptyStateCard
          title="No bookings yet"
          description="Start from the live days feed, add the next trip, and come back here when you need to store the private references."
          action={
            <Button component={Link} to="/dashboard/days">
              Browse available days
            </Button>
          }
        />
      ) : (
        <Grid gap={{ base: 'md', sm: 'lg' }} align="start">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper
              className="shell-card booking-list-panel"
              p={{ base: 'sm', sm: 'md' }}
            >
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Stack gap={2}>
                    <Title order={3}>Trips</Title>
                    <Text size="sm" c="dimmed">
                      Choose a booking to review or edit.
                    </Text>
                  </Stack>
                  <Text size="sm" fw={700} c="dimmed">
                    {filteredBookings.length} shown
                  </Text>
                </Group>

                <Grid gap="sm">
                  <Grid.Col span={{ base: 12, sm: 7, lg: 12, xl: 7 }}>
                    <TextInput
                      aria-label="Search trips"
                      placeholder="Search circuit, provider, stay, or reference"
                      value={searchQuery}
                      onChange={(event) =>
                        setSearchQuery(event.currentTarget.value)
                      }
                      leftSection={<IconSearch size={16} />}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 5, lg: 12, xl: 5 }}>
                    <Select
                      aria-label="Filter trips by status"
                      comboboxProps={{ withinPortal: false }}
                      value={statusFilter}
                      onChange={(value) =>
                        setStatusFilter(
                          (value as BookingFilter | null) ?? 'all',
                        )
                      }
                      data={[
                        { value: 'all', label: 'All statuses' },
                        { value: 'booked', label: 'Booked' },
                        { value: 'maybe', label: 'Maybe' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                    />
                  </Grid.Col>
                </Grid>

                <ScrollArea.Autosize
                  offsetScrollbars
                  className="booking-list-scroll"
                >
                  {filteredBookings.length > 0 ? (
                    <Stack gap="lg">
                      {bookingSections.map((section) => (
                        <Stack key={section.label} gap="xs">
                          <Text
                            size="sm"
                            fw={700}
                            c="dimmed"
                            className="booking-section-label"
                          >
                            {section.label}
                          </Text>
                          <Stack gap={0}>
                            {section.items.map((booking, index) => (
                              <div key={booking.bookingId}>
                                <BookingListItem
                                  booking={booking}
                                  active={
                                    booking.bookingId ===
                                    selectedBooking?.bookingId
                                  }
                                  onSelect={() =>
                                    setSelectedBookingId(booking.bookingId)
                                  }
                                />
                                {index < section.items.length - 1 ? (
                                  <Divider />
                                ) : null}
                              </div>
                            ))}
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  ) : (
                    <Stack gap="sm" py="sm">
                      <Text fw={700}>No trips match that view</Text>
                      <Text size="sm" c="dimmed">
                        Clear the search or widen the status filter to bring
                        more bookings back into the list.
                      </Text>
                      <Group>
                        <Button
                          type="button"
                          variant="default"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                          }}
                        >
                          Clear filters
                        </Button>
                      </Group>
                    </Stack>
                  )}
                </ScrollArea.Autosize>
              </Stack>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 8 }}>
            {selectedBooking ? (
              <BookingEditorPanel
                key={selectedBooking.bookingId}
                booking={selectedBooking}
                hotelInsight={
                  selectedBooking.hotelId
                    ? hotelInsights[selectedBooking.hotelId]
                    : undefined
                }
                garageShareRequests={garageShareRequests}
                selectedIndex={selectedIndex}
                totalBookings={filteredBookings.length}
                hasPrevious={selectedIndex > 0}
                hasNext={
                  selectedIndex >= 0 &&
                  selectedIndex < filteredBookings.length - 1
                }
                onSelectPrevious={() =>
                  setSelectedBookingId(
                    filteredBookings[Math.max(0, selectedIndex - 1)]
                      ?.bookingId ?? selectedBooking.bookingId,
                  )
                }
                onSelectNext={() =>
                  setSelectedBookingId(
                    filteredBookings[
                      Math.min(filteredBookings.length - 1, selectedIndex + 1)
                    ]?.bookingId ?? selectedBooking.bookingId,
                  )
                }
              />
            ) : null}
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
