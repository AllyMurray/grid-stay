import {
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  Grid,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { Link, useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  AdminMemberProfile,
  AdminMemberSeriesActionResult,
  AdminSeriesOption,
} from '~/lib/admin/member-management.server';

export interface AdminMemberDetailPageProps {
  profile: AdminMemberProfile;
  seriesOptions: AdminSeriesOption[];
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function bookingColor(
  status: AdminMemberProfile['bookings'][number]['status'],
) {
  switch (status) {
    case 'booked':
      return 'green';
    case 'maybe':
      return 'yellow';
    case 'cancelled':
      return 'gray';
  }
}

function getFieldError(
  fieldErrors: Partial<Record<string, string[] | undefined>> | undefined,
  fieldName: string,
) {
  return fieldErrors?.[fieldName]?.[0] ?? undefined;
}

function MemberBookings({ profile }: { profile: AdminMemberProfile }) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={3}>Upcoming bookings</Title>
          <Text size="sm" c="dimmed">
            Shared trip details only.
          </Text>
        </Stack>

        {profile.bookings.length > 0 ? (
          <Stack gap="md">
            {profile.bookings.map((booking, index) => (
              <Stack key={booking.bookingId} gap="md">
                <Group justify="space-between" align="flex-start" gap="md">
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={700}>{booking.circuit}</Text>
                      <Badge
                        color={bookingColor(booking.status)}
                        variant="light"
                        size="sm"
                      >
                        {titleCase(booking.status)}
                      </Badge>
                    </Group>

                    <Text size="sm" c="dimmed">
                      {formatFullDate(booking.date)} • {booking.provider}
                    </Text>

                    <Text size="sm">{booking.description}</Text>

                    <Text size="sm" c="dimmed">
                      Stay •{' '}
                      {booking.accommodationName ?? 'No shared stay added yet'}
                    </Text>
                  </Stack>
                </Group>
                {index < profile.bookings.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Stack gap={4} align="center" py="xl">
            <Text fw={700}>No upcoming bookings</Text>
            <Text size="sm" c="dimmed" ta="center">
              Series assignments will add missing future events here.
            </Text>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

function SeriesManagement({
  profile,
  seriesOptions,
}: AdminMemberDetailPageProps) {
  const fetcher = useFetcher<AdminMemberSeriesActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;
  const seriesSelectOptions = seriesOptions.map((series) => ({
    value: series.seriesKey,
    label: `${series.seriesName} (${series.dayCount} days)`,
  }));

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={3}>Series subscriptions</Title>
          <Text size="sm" c="dimmed">
            Add future events for a member without changing existing booking
            notes or references.
          </Text>
        </Stack>

        {success ? (
          <Alert color="green" variant="light">
            {success.message}
            {success.addedCount !== undefined ? (
              <>
                {' '}
                {success.addedCount} added, {success.existingCount} already
                present.
              </>
            ) : null}
          </Alert>
        ) : formError ? (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        ) : null}

        <fetcher.Form method="post" key={success?.message ?? 'add-series'}>
          <Stack gap="md">
            <Select
              label="Series"
              name="seriesKey"
              placeholder="Choose a series"
              data={seriesSelectOptions}
              searchable
              required
              error={getFieldError(fieldErrors, 'seriesKey')}
            />
            <Select
              label="Status"
              name="status"
              data={[
                { value: 'maybe', label: 'Maybe' },
                { value: 'booked', label: 'Booked' },
              ]}
              defaultValue="maybe"
              allowDeselect={false}
              error={getFieldError(fieldErrors, 'status')}
            />
            <Button
              type="submit"
              name="intent"
              value="addSeries"
              leftSection={<IconPlus size={16} />}
              loading={isSubmitting}
            >
              Add series
            </Button>
          </Stack>
        </fetcher.Form>

        <Divider />

        {profile.subscriptions.length > 0 ? (
          <Stack gap="md">
            {profile.subscriptions.map((subscription, index) => (
              <Stack key={subscription.seriesKey} gap="md">
                <fetcher.Form method="post">
                  <input
                    type="hidden"
                    name="seriesKey"
                    value={subscription.seriesKey}
                  />
                  <Stack gap="sm">
                    <Group
                      justify="space-between"
                      align="flex-start"
                      gap="md"
                      wrap="wrap"
                    >
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={700}>{subscription.seriesName}</Text>
                        <Text size="xs" c="dimmed">
                          Last updated{' '}
                          {formatFullDate(subscription.updatedAt.slice(0, 10))}
                        </Text>
                      </Stack>
                      <Badge
                        color={
                          subscription.status === 'booked' ? 'green' : 'yellow'
                        }
                        variant="light"
                      >
                        {titleCase(subscription.status)}
                      </Badge>
                    </Group>

                    <Group gap="sm" align="flex-end" wrap="wrap">
                      <Select
                        label="Status"
                        name="status"
                        data={[
                          { value: 'maybe', label: 'Maybe' },
                          { value: 'booked', label: 'Booked' },
                        ]}
                        defaultValue={subscription.status}
                        allowDeselect={false}
                        style={{ minWidth: 180 }}
                      />
                      <Button
                        type="submit"
                        name="intent"
                        value="updateSeries"
                        variant="default"
                        leftSection={<IconDeviceFloppy size={16} />}
                        loading={isSubmitting}
                      >
                        Save
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value="removeSeries"
                        variant="subtle"
                        color="red"
                        leftSection={<IconTrash size={16} />}
                        loading={isSubmitting}
                      >
                        Remove
                      </Button>
                    </Group>
                  </Stack>
                </fetcher.Form>
                {index < profile.subscriptions.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Stack gap={4} align="center" py="md">
            <Text fw={700}>No series subscriptions</Text>
            <Text size="sm" c="dimmed" ta="center">
              Add a series to create the missing bookings for this member.
            </Text>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

export function AdminMemberDetailPage({
  profile,
  seriesOptions,
}: AdminMemberDetailPageProps) {
  const activeBookings = profile.bookings.filter(
    (booking) => booking.status !== 'cancelled',
  );
  const sharedStays = new Set(
    activeBookings
      .map((booking) => booking.accommodationName?.trim())
      .filter((name): name is string => Boolean(name)),
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title={profile.name}
        description={profile.email}
        actions={
          <Button
            component={Link}
            to="/dashboard/admin/members"
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to members
          </Button>
        }
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Upcoming', value: profile.bookings.length },
              { label: 'Active', value: activeBookings.length },
              { label: 'Series', value: profile.subscriptions.length },
              { label: 'Shared stays', value: sharedStays.size },
            ]}
          />
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Group gap="sm" align="center" wrap="nowrap">
          <Avatar
            src={profile.picture}
            alt={profile.name}
            radius="sm"
            size={48}
          >
            {profile.name.charAt(0).toUpperCase()}
          </Avatar>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={700}>{profile.name}</Text>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {profile.email}
            </Text>
          </Stack>
        </Group>
      </Paper>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <MemberBookings profile={profile} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <SeriesManagement profile={profile} seriesOptions={seriesOptions} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
