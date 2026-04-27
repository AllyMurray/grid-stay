import {
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { CreateManualDayActionResult } from '~/lib/days/actions.server';
import type { DaySourceError } from '~/lib/days/types';
import type { ManualDayRecord } from '~/lib/db/entities/manual-day.server';

export interface ManualDaysPageProps {
  manualDays: ManualDayRecord[];
  sourceErrors: DaySourceError[];
  refreshedAt: string;
  circuitOptions: string[];
  providerOptions: string[];
  seriesOptions: string[];
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFullDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatCreatedDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
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

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function FeedSourceStatus({
  sourceErrors,
  refreshedAt,
}: Pick<ManualDaysPageProps, 'sourceErrors' | 'refreshedAt'>) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={3}>Feed source status</Title>
          <Text size="sm" c="dimmed">
            Last refresh {formatRefreshedAt(refreshedAt)}
          </Text>
        </Stack>

        {sourceErrors.length > 0 ? (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
            <Stack gap={4}>
              <Text size="sm" fw={700}>
                Some sources could not be loaded.
              </Text>
              {sourceErrors.map((error) => (
                <Text key={`${error.source}:${error.message}`} size="sm">
                  {error.source}: {error.message}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : (
          <Text size="sm" c="dimmed">
            No source loading errors were reported in the latest snapshot.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function getFieldError(
  fieldErrors: Partial<Record<string, string[] | undefined>> | undefined,
  fieldName: string,
) {
  return fieldErrors?.[fieldName]?.[0] ?? undefined;
}

function groupManualDaysByMonth(manualDays: ManualDayRecord[]) {
  const groups = new Map<string, ManualDayRecord[]>();

  for (const manualDay of manualDays) {
    const monthKey = manualDay.date.slice(0, 7);
    const current = groups.get(monthKey);
    if (current) {
      current.push(manualDay);
      continue;
    }

    groups.set(monthKey, [manualDay]);
  }

  return [...groups.entries()].map(([month, days]) => ({ month, days }));
}

function ManualDayForm({
  circuitOptions,
  providerOptions,
  seriesOptions,
}: Pick<
  ManualDaysPageProps,
  'circuitOptions' | 'providerOptions' | 'seriesOptions'
>) {
  const fetcher = useFetcher<CreateManualDayActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const successResult = fetcher.data?.ok ? fetcher.data : null;
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={3}>Add a manual day</Title>
          <Text size="sm" c="dimmed">
            Add Caterham dates that should appear in the shared calendar even
            when they are not part of the official scrape.
          </Text>
        </Stack>

        <fetcher.Form
          method="post"
          key={successResult?.dayId ?? 'manual-day-form'}
        >
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
              <TextInput
                label="Date"
                name="date"
                type="date"
                required
                error={getFieldError(fieldErrors, 'date')}
              />
              <Select
                label="Type"
                name="type"
                data={[
                  { value: 'race_day', label: 'Race day' },
                  { value: 'test_day', label: 'Test day' },
                  { value: 'track_day', label: 'Track day' },
                ]}
                defaultValue="track_day"
                allowDeselect={false}
                error={getFieldError(fieldErrors, 'type')}
              />
              <Autocomplete
                label="Circuit"
                name="circuit"
                placeholder="Start typing a circuit"
                data={circuitOptions}
                required
                error={getFieldError(fieldErrors, 'circuit')}
              />
              <Autocomplete
                label="Provider"
                name="provider"
                placeholder="Start typing a provider"
                data={providerOptions}
                required
                error={getFieldError(fieldErrors, 'provider')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
              <Autocomplete
                label="Series"
                name="series"
                placeholder="Caterham 270R"
                data={seriesOptions}
                description="Optional. Use this when a manual race day belongs to a series."
                error={getFieldError(fieldErrors, 'series')}
              />
              <TextInput
                label="Booking link"
                name="bookingUrl"
                placeholder="https://..."
                error={getFieldError(fieldErrors, 'bookingUrl')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1 }} spacing="md">
              <Textarea
                label="Session details"
                name="description"
                placeholder="Pre-season track day"
                rows={2}
                error={getFieldError(fieldErrors, 'description')}
              />
            </SimpleGrid>

            <Group justify="space-between" align="center" gap="sm">
              <Stack gap={4}>
                {successResult ? (
                  <Text size="sm" c="green">
                    Manual day added to the shared calendar.
                  </Text>
                ) : formError ? (
                  <Text size="sm" c="red">
                    {formError}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    Once saved, the day appears here and in Available Days for
                    everyone.
                  </Text>
                )}
              </Stack>

              <Button type="submit" loading={isSubmitting}>
                Save manual day
              </Button>
            </Group>
          </Stack>
        </fetcher.Form>
      </Stack>
    </Paper>
  );
}

function ManualDayRow({ manualDay }: { manualDay: ManualDayRecord }) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={700}>{manualDay.circuit}</Text>
            <Badge color="brand" variant="light" size="sm">
              {titleCase(manualDay.type)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {formatFullDate(manualDay.date)} • {manualDay.provider}
          </Text>
          {manualDay.series ? (
            <Text size="xs" c="dimmed">
              Series • {manualDay.series}
            </Text>
          ) : null}
          <Text size="sm">{manualDay.description || 'No extra details'}</Text>
          <Text size="xs" c="dimmed">
            Added {formatCreatedDate(manualDay.createdAt)}
          </Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          {manualDay.bookingUrl ? (
            <Anchor
              component="a"
              href={manualDay.bookingUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              fw={700}
            >
              Provider site
            </Anchor>
          ) : null}
          <Button
            component={Link}
            to={`/dashboard/days?day=${encodeURIComponent(manualDay.dayId)}`}
            variant="default"
            size="sm"
          >
            Open in available days
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}

export function ManualDaysPage({
  manualDays,
  sourceErrors,
  refreshedAt,
  circuitOptions,
  providerOptions,
  seriesOptions,
}: ManualDaysPageProps) {
  const groups = groupManualDaysByMonth(manualDays);

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Manual Days"
        description="Add and review the extra days that should appear in the shared calendar outside the official scrape."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Manual days', value: manualDays.length },
              {
                label: 'Circuits',
                value: new Set(manualDays.map((day) => day.circuit)).size,
              },
              {
                label: 'With booking links',
                value: manualDays.filter((day) => day.bookingUrl).length,
              },
              {
                label: 'Linked to series',
                value: manualDays.filter((day) => day.series).length,
              },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/days" variant="default">
            Back to available days
          </Button>
        }
      />

      <FeedSourceStatus sourceErrors={sourceErrors} refreshedAt={refreshedAt} />

      <ManualDayForm
        circuitOptions={circuitOptions}
        providerOptions={providerOptions}
        seriesOptions={seriesOptions}
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Stack gap={2}>
            <Title order={3}>Manually added days</Title>
            <Text size="sm" c="dimmed">
              These entries stay managed here, but they still appear in the main
              Available Days feed once saved.
            </Text>
          </Stack>

          {groups.length > 0 ? (
            <Stack gap="lg">
              {groups.map((group) => (
                <Stack key={group.month} gap="md">
                  <Text size="sm" fw={700} c="dimmed">
                    {formatMonthLabel(group.month)}
                  </Text>
                  <Stack gap="md">
                    {group.days.map((manualDay, index) => (
                      <Stack key={manualDay.manualDayId} gap="md">
                        <ManualDayRow manualDay={manualDay} />
                        {index < group.days.length - 1 ? <Divider /> : null}
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyStateCard
              title="No manual days yet"
              description="Add the first extra Caterham date here and it will appear in Available Days for everyone."
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
