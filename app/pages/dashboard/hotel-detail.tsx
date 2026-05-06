import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconBuildingSkyscraper, IconStar } from '@tabler/icons-react';
import { Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type { HotelReviewRecord } from '~/lib/db/entities/hotel-review.server';
import type { HotelInsight } from '~/lib/db/services/hotel.server';

export interface HotelDetailPageProps {
  insight: HotelInsight;
  currentUserId: string;
}

function getRatingLabel(value?: number) {
  return value ? `${value}/5` : 'No rating yet';
}

function getReviewDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getParkingLabel(value: HotelReviewRecord['trailerParking']) {
  switch (value) {
    case 'good':
      return 'Good trailer parking';
    case 'limited':
      return 'Limited trailer parking';
    case 'none':
      return 'No trailer parking';
    case 'unknown':
      return 'Trailer parking unknown';
  }
}

function getSecureParkingLabel(value: HotelReviewRecord['secureParking']) {
  switch (value) {
    case 'yes':
      return 'Secure parking';
    case 'mixed':
      return 'Mixed secure parking';
    case 'no':
      return 'No secure parking';
    case 'unknown':
      return 'Security unknown';
  }
}

function getLateCheckInLabel(value: HotelReviewRecord['lateCheckIn']) {
  switch (value) {
    case 'yes':
      return 'Late check-in';
    case 'limited':
      return 'Limited late check-in';
    case 'no':
      return 'No late check-in';
    case 'unknown':
      return 'Late check-in unknown';
  }
}

function HotelReviewCard({ review }: { review: HotelReviewRecord }) {
  const notes = [
    { label: 'Parking notes', value: review.parkingNotes },
    { label: 'General notes', value: review.generalNotes },
  ].filter((note): note is { label: string; value: string } =>
    Boolean(note.value),
  );

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="sm">
        <Group justify="space-between" gap="sm" align="flex-start">
          <Stack gap={2}>
            <Text fw={700}>{review.userName}</Text>
            <Text size="xs" c="dimmed">
              Updated {getReviewDate(review.updatedAt)}
            </Text>
          </Stack>
          <Group gap={4} wrap="nowrap">
            <IconStar size={16} />
            <Text fw={700}>{getRatingLabel(review.rating)}</Text>
          </Group>
        </Group>

        <Group gap="xs" wrap="wrap">
          <Badge size="xs" variant="light" color="blue">
            {getParkingLabel(review.trailerParking)}
          </Badge>
          <Badge size="xs" variant="light" color="gray">
            {getSecureParkingLabel(review.secureParking)}
          </Badge>
          <Badge size="xs" variant="light" color="gray">
            {getLateCheckInLabel(review.lateCheckIn)}
          </Badge>
        </Group>

        {notes.length > 0 ? (
          <Stack gap="sm">
            {notes.map((note, index) => (
              <Stack key={note.label} gap={4}>
                {index > 0 ? <Divider /> : null}
                <Text size="xs" fw={700} c="dimmed">
                  {note.label}
                </Text>
                <Text size="sm">{note.value}</Text>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No written notes yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

export function HotelDetailPage({
  insight,
  currentUserId,
}: HotelDetailPageProps) {
  const hasMyReview = insight.reviews.some(
    (review) => review.userId === currentUserId,
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Hotel record"
        title={insight.hotel.name}
        description="Review the group summary and member feedback before choosing where to stay."
        actions={
          <Group gap="sm">
            <Button component={Link} to="/dashboard/hotels" variant="default">
              Back to hotels
            </Button>
            <Button
              component={Link}
              to={`/dashboard/hotels/${insight.hotel.hotelId}/feedback`}
            >
              {hasMyReview ? 'Edit my feedback' : 'Add feedback'}
            </Button>
          </Group>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" gap="md">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={38} radius="sm" color="blue" variant="light">
                <IconBuildingSkyscraper size={22} />
              </ThemeIcon>
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Title order={2}>{insight.hotel.name}</Title>
                {insight.hotel.address ? (
                  <Text size="sm" c="dimmed">
                    {insight.hotel.address}
                  </Text>
                ) : null}
                <Text size="sm">{insight.summary}</Text>
              </Stack>
            </Group>

            <Stack gap={2} align="flex-end" visibleFrom="sm">
              <Group gap={4} wrap="nowrap">
                <IconStar size={16} />
                <Text fw={700}>{getRatingLabel(insight.averageRating)}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {insight.reviewCount}{' '}
                {insight.reviewCount === 1 ? 'review' : 'reviews'}
              </Text>
            </Stack>
          </Group>

          <Group gap="xs" wrap="wrap">
            <Badge size="sm" variant="light" color="gray" hiddenFrom="sm">
              {getRatingLabel(insight.averageRating)}
            </Badge>
            <Badge size="sm" variant="light" color="gray" hiddenFrom="sm">
              {insight.reviewCount}{' '}
              {insight.reviewCount === 1 ? 'review' : 'reviews'}
            </Badge>
            <Badge size="xs" variant="light" color="blue">
              {insight.summarySource === 'bedrock'
                ? 'AI summary'
                : 'Review summary'}
            </Badge>
            <Badge size="xs" variant="light" color="gray">
              {insight.hotel.source === 'geoapify'
                ? 'Address lookup'
                : 'Manual hotel'}
            </Badge>
          </Group>

          {insight.hotel.attribution ? (
            <Text size="xs" c="dimmed">
              {insight.hotel.attribution}
            </Text>
          ) : null}
        </Stack>
      </Paper>

      <Stack gap="md">
        <Group justify="space-between" gap="sm" align="flex-end">
          <Stack gap={2}>
            <Title order={2}>Member feedback</Title>
            <Text size="sm" c="dimmed">
              Parking, check-in, and stay notes from the group.
            </Text>
          </Stack>
        </Group>

        {insight.reviews.length > 0 ? (
          <Stack gap="md">
            {insight.reviews.map((review) => (
              <HotelReviewCard key={review.reviewId} review={review} />
            ))}
          </Stack>
        ) : (
          <EmptyStateCard
            title="No member feedback yet"
            description="Add the first hotel review once someone has stayed here."
          />
        )}
      </Stack>
    </Stack>
  );
}
