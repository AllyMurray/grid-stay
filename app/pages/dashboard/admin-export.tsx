import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminDataExportSummary } from '~/lib/admin/export.server';

export interface AdminExportPageProps {
  summary: AdminDataExportSummary;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminExportPage({ summary }: AdminExportPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Data export"
        description="Download a point-in-time JSON copy of production data used by the app."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Members', value: summary.memberCount },
              { label: 'Bookings', value: summary.bookingCount },
              { label: 'Manual days', value: summary.manualDayCount },
              { label: 'Shared plans', value: summary.sharedPlanCount },
              { label: 'Available days', value: summary.availableDayCount },
            ]}
          />
        }
        actions={
          <Button
            component="a"
            href="/dashboard/admin/export?download=json"
            leftSection={<IconDownload size={16} />}
          >
            Download JSON
          </Button>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Export contents</Title>
            <Text size="sm" c="dimmed">
              Snapshot prepared {formatTimestamp(summary.exportedAt)}
            </Text>
          </Stack>

          <Group gap="xl" wrap="wrap">
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Invites
              </Text>
              <Text fw={800}>{summary.inviteCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Legacy event requests
              </Text>
              <Text fw={800}>{summary.eventRequestCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Series subscriptions
              </Text>
              <Text fw={800}>{summary.seriesSubscriptionCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Calendar feeds
              </Text>
              <Text fw={800}>{summary.calendarFeedCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Circuit aliases
              </Text>
              <Text fw={800}>{summary.circuitAliasCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Day merges
              </Text>
              <Text fw={800}>{summary.dayMergeCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                External notifications
              </Text>
              <Text fw={800}>{summary.externalNotificationCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Garage requests
              </Text>
              <Text fw={800}>{summary.garageShareRequestCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Feedback
              </Text>
              <Text fw={800}>{summary.feedbackCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Cost groups
              </Text>
              <Text fw={800}>{summary.costGroupCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Cost expenses
              </Text>
              <Text fw={800}>{summary.costExpenseCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Cost settlements
              </Text>
              <Text fw={800}>{summary.costSettlementCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                Payment preferences
              </Text>
              <Text fw={800}>{summary.memberPaymentPreferenceCount}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={700}>
                What's new views
              </Text>
              <Text fw={800}>{summary.whatsNewViewCount}</Text>
            </Stack>
          </Group>

          <Text size="sm" c="dimmed">
            Calendar feed tokens are redacted from the export. Booking
            references, accommodation references, and private notes are
            included.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
