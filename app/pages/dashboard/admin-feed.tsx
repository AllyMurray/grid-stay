import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminFeedStatusReport } from '~/lib/days/admin-feed.server';

export type AdminFeedPageProps = AdminFeedStatusReport;

function formatRefreshedAt(value: string) {
  if (!value) {
    return 'Waiting for the first refresh';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDateRange(range: AdminFeedPageProps['dateRange']) {
  if (!range) {
    return 'No available days';
  }

  return `${range.firstDate} to ${range.lastDate}`;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function healthColor(status: AdminFeedPageProps['health']['status']) {
  switch (status) {
    case 'healthy':
      return 'green';
    case 'empty':
    case 'stale':
    case 'warning':
      return 'yellow';
  }
}

export function AdminFeedPage({
  sourceErrors,
  refreshedAt,
  dayCount,
  snapshotDayCount,
  manualDayCount,
  dateRange,
  sourceSummaries,
  health,
}: AdminFeedPageProps) {
  const hasErrors = sourceErrors.length > 0;
  const healthIcon =
    health.status === 'healthy' ? (
      <IconCircleCheck size={18} />
    ) : (
      <IconAlertCircle size={18} />
    );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Feed status"
        description="Review the latest available-days source health and snapshot status."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Available days', value: dayCount },
              { label: 'Source days', value: snapshotDayCount },
              { label: 'Manual days', value: manualDayCount },
              { label: 'Source errors', value: sourceErrors.length },
              { label: 'Last refresh', value: formatRefreshedAt(refreshedAt) },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/days" variant="default">
            Open available days
          </Button>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Latest source check</Title>
            <Text size="sm" c="dimmed">
              Last refresh {formatRefreshedAt(refreshedAt)} •{' '}
              {formatDateRange(dateRange)}
            </Text>
          </Stack>

          <Alert color={healthColor(health.status)} icon={healthIcon}>
            <Stack gap={4}>
              <Text size="sm" fw={700}>
                {titleCase(health.status)}
              </Text>
              <Text size="sm">{health.message}</Text>
            </Stack>
          </Alert>

          {hasErrors ? (
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
            <Alert color="green" icon={<IconCircleCheck size={18} />}>
              No source loading errors were reported in the latest snapshot.
            </Alert>
          )}

          <Divider />

          <Stack gap="sm">
            <Group justify="space-between" align="flex-end">
              <Stack gap={2}>
                <Title order={4}>Source coverage</Title>
                <Text size="sm" c="dimmed">
                  Counts include cached source days and global manual days.
                </Text>
              </Stack>
              <Badge variant="light" color="gray">
                {sourceSummaries.length}{' '}
                {sourceSummaries.length === 1 ? 'source' : 'sources'}
              </Badge>
            </Group>

            {sourceSummaries.length > 0 ? (
              <ScrollArea>
                <Table striped highlightOnHover miw={620}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Days</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {sourceSummaries.map((source) => (
                      <Table.Tr key={source.key}>
                        <Table.Td>{source.label}</Table.Td>
                        <Table.Td>{titleCase(source.sourceType)}</Table.Td>
                        <Table.Td>{source.dayCount}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            ) : (
              <Text size="sm" c="dimmed">
                No source rows are available yet.
              </Text>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
