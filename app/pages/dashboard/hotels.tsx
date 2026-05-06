import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBuildingSkyscraper,
  IconSearch,
  IconStar,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type { HotelSummaryInsight } from '~/lib/db/services/hotel.server';

export interface HotelsPageProps {
  hotels: HotelSummaryInsight[];
}

function getRatingLabel(value?: number) {
  return value ? `${value}/5` : 'No rating yet';
}

function matchesHotel(insight: HotelSummaryInsight, query: string) {
  const value = query.trim().toLowerCase();
  if (!value) {
    return true;
  }

  return [
    insight.hotel.name,
    insight.hotel.address,
    insight.hotel.postcode,
    insight.summary,
  ].some((field) => field?.toLowerCase().includes(value));
}

function HotelCard({ insight }: { insight: HotelSummaryInsight }) {
  return (
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

          <Stack gap={4} align="flex-end" visibleFrom="sm">
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

        <Group gap="xs" wrap="wrap" hiddenFrom="sm">
          <Badge size="sm" variant="light" color="gray">
            {getRatingLabel(insight.averageRating)}
          </Badge>
          <Badge size="sm" variant="light" color="gray">
            {insight.reviewCount}{' '}
            {insight.reviewCount === 1 ? 'review' : 'reviews'}
          </Badge>
        </Group>

        <Group gap="xs" wrap="wrap">
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

        <Group justify="flex-end">
          <Button
            component={Link}
            to={`/dashboard/hotels/${insight.hotel.hotelId}`}
            variant="default"
            fullWidth={false}
          >
            View hotel
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export function HotelsPage({ hotels }: HotelsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredHotels = useMemo(
    () => hotels.filter((hotel) => matchesHotel(hotel, searchQuery)),
    [hotels, searchQuery],
  );
  const reviewedCount = hotels.filter((hotel) => hotel.reviewCount > 0).length;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Hotels"
        title="Saved hotels"
        description="Browse saved hotels and the group summary before opening a hotel record for member feedback."
      />

      <Group gap="lg" wrap="wrap">
        <Text size="sm" c="dimmed">
          {hotels.length} {hotels.length === 1 ? 'hotel' : 'hotels'} saved
        </Text>
        <Text size="sm" c="dimmed">
          {reviewedCount} {reviewedCount === 1 ? 'hotel has' : 'hotels have'}{' '}
          feedback
        </Text>
      </Group>

      <TextInput
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.currentTarget.value)}
        label="Search hotels"
        placeholder="Search by hotel, address, or summary"
        leftSection={<IconSearch size={16} />}
      />

      {filteredHotels.length > 0 ? (
        <Stack gap="md">
          {filteredHotels.map((hotel) => (
            <HotelCard key={hotel.hotel.hotelId} insight={hotel} />
          ))}
        </Stack>
      ) : hotels.length > 0 ? (
        <EmptyStateCard
          title="No hotels match that search"
          description="Try a hotel name, address, or summary term."
        />
      ) : (
        <EmptyStateCard
          title="No saved hotels yet"
          description="Save a hotel from My Bookings and it will appear here for the group to review."
        />
      )}
    </Stack>
  );
}
