import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconDeviceFloppy, IconTrash } from '@tabler/icons-react';
import { useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  AdminDayMergeActionResult,
  AdminDayMergesReport,
} from '~/lib/admin/day-merges.server';

export type AdminDayMergesPageProps = AdminDayMergesReport;
type DayMergeFieldErrors = Extract<
  AdminDayMergeActionResult,
  { ok: false }
>['fieldErrors'];

function getFieldError(
  fieldErrors: DayMergeFieldErrors | undefined,
  fieldName: keyof DayMergeFieldErrors,
) {
  return fieldErrors?.[fieldName]?.[0];
}

export function AdminDayMergesPage({ days, merges }: AdminDayMergesPageProps) {
  const fetcher = useFetcher<AdminDayMergeActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;
  const dayOptions = days.map((day) => ({
    value: day.dayId,
    label: day.label,
  }));

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Day merge rules"
        description="Consolidate duplicate available days and migrate existing member plans to the day that should remain visible."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Available days', value: days.length },
              { label: 'Merge rules', value: merges.length },
            ]}
          />
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Create merge</Title>
            <Text size="sm" c="dimmed">
              Choose the duplicate source day, then the canonical day that keeps
              bookings and shared plans.
            </Text>
          </Stack>

          {success ? (
            <Alert color="green" variant="light">
              {success.message}
              {success.movedBookingCount !== undefined ? (
                <>
                  {' '}
                  {success.movedBookingCount} moved,{' '}
                  {success.mergedBookingCount} merged.
                </>
              ) : null}
            </Alert>
          ) : formError ? (
            <Alert color="red" variant="light">
              {formError}
            </Alert>
          ) : null}

          <fetcher.Form method="post">
            <Stack gap="md">
              <Select
                name="sourceDayId"
                label="Duplicate source day"
                placeholder="Choose the day to hide"
                data={dayOptions}
                searchable
                required
                error={getFieldError(fieldErrors, 'sourceDayId')}
              />
              <Select
                name="targetDayId"
                label="Canonical target day"
                placeholder="Choose the day to keep"
                data={dayOptions}
                searchable
                required
                error={getFieldError(fieldErrors, 'targetDayId')}
              />
              <TextInput
                name="reason"
                label="Reason"
                placeholder="Duplicate Caterham import"
                error={getFieldError(fieldErrors, 'reason')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  name="intent"
                  value="saveMerge"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSubmitting}
                >
                  Save merge
                </Button>
              </Group>
            </Stack>
          </fetcher.Form>
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Configured merges</Title>
            <Text size="sm" c="dimmed">
              Source days are hidden when their target day exists in the feed.
            </Text>
          </Stack>

          {merges.length > 0 ? (
            <Stack gap="md">
              {merges.map((merge) => (
                <fetcher.Form method="post" key={merge.sourceDayId}>
                  <Group justify="space-between" gap="md" wrap="wrap">
                    <Stack gap={4} style={{ flex: 1, minWidth: 240 }}>
                      <Text fw={700}>
                        {merge.sourceLabel ?? merge.sourceDayId}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Keeps {merge.targetLabel ?? merge.targetDayId}
                      </Text>
                      {merge.reason ? (
                        <Text size="xs" c="dimmed">
                          {merge.reason}
                        </Text>
                      ) : null}
                    </Stack>
                    <input
                      type="hidden"
                      name="sourceDayId"
                      value={merge.sourceDayId}
                    />
                    <Button
                      type="submit"
                      name="intent"
                      value="deleteMerge"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      loading={isSubmitting}
                    >
                      Remove
                    </Button>
                  </Group>
                </fetcher.Form>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No day merge rules have been configured.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
