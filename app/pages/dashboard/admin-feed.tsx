import { Alert, Button, Paper, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { DaySourceError } from '~/lib/days/types';

export interface AdminFeedPageProps {
  sourceErrors: DaySourceError[];
  refreshedAt: string;
  dayCount: number;
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

export function AdminFeedPage({
  sourceErrors,
  refreshedAt,
  dayCount,
}: AdminFeedPageProps) {
  const hasErrors = sourceErrors.length > 0;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Feed status"
        description="Review the latest available-days source health and snapshot status."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Snapshot days', value: dayCount },
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
              Last refresh {formatRefreshedAt(refreshedAt)}
            </Text>
          </Stack>

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
        </Stack>
      </Paper>
    </Stack>
  );
}
