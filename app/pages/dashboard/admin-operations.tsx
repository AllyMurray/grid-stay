import {
  Badge,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminOperationsReport } from '~/lib/admin/operations.server';
import type { AppEvent } from '~/lib/db/services/app-event.server';
import type { ExternalNotificationRecord } from '~/lib/db/services/external-notification.server';

export type AdminOperationsPageProps = AdminOperationsReport;

function formatTimestamp(value: string | undefined) {
  if (!value) {
    return 'None recorded';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function severityColor(severity: AppEvent['severity']) {
  switch (severity) {
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    case 'info':
      return 'blue';
  }
}

function notificationStatusColor(status: ExternalNotificationRecord['status']) {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'sent':
      return 'green';
    case 'cancelled':
      return 'gray';
  }
}

function getActorLabel(event: AppEvent) {
  return event.actorName ?? event.actorUserId ?? 'System';
}

function getSubjectLabel(event: AppEvent) {
  if (!event.subjectType && !event.subjectId) {
    return 'None';
  }

  return [event.subjectType, event.subjectId].filter(Boolean).join(' ');
}

export function AdminOperationsPage({
  events,
  externalNotifications,
  errorCount,
  warningCount,
  pendingExternalNotificationCount,
  lastErrorAt,
}: AdminOperationsPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Operations"
        description="Review recent audit, operational, and error events."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Events', value: events.length },
              { label: 'Errors', value: errorCount },
              { label: 'Warnings', value: warningCount },
              {
                label: 'Pending alerts',
                value: pendingExternalNotificationCount,
              },
              { label: 'Last error', value: formatTimestamp(lastErrorAt) },
            ]}
          />
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>Recent events</Title>
              <Text size="sm" c="dimmed">
                Showing the latest 100 records kept by the app.
              </Text>
            </Stack>
          </Group>

          {events.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover miw={920}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Level</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Actor</Table.Th>
                    <Table.Th>Subject</Table.Th>
                    <Table.Th>Message</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {events.map((event) => (
                    <Table.Tr key={event.eventId}>
                      <Table.Td>{formatTimestamp(event.createdAt)}</Table.Td>
                      <Table.Td>
                        <Badge
                          color={severityColor(event.severity)}
                          variant="light"
                        >
                          {titleCase(event.severity)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{titleCase(event.category)}</Table.Td>
                      <Table.Td>{titleCase(event.action)}</Table.Td>
                      <Table.Td>{getActorLabel(event)}</Table.Td>
                      <Table.Td>{getSubjectLabel(event)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {event.message}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed">
              No events have been recorded yet.
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Stack gap={2}>
              <Title order={3}>External notification outbox</Title>
              <Text size="sm" c="dimmed">
                Pending member alerts and admin error notices queued by the app.
              </Text>
            </Stack>
          </Group>

          {externalNotifications.length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover miw={920}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Channel</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Recipient</Table.Th>
                    <Table.Th>Subject</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {externalNotifications.map((notification) => (
                    <Table.Tr key={notification.notificationId}>
                      <Table.Td>
                        {formatTimestamp(notification.createdAt)}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={notificationStatusColor(notification.status)}
                          variant="light"
                        >
                          {titleCase(notification.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{titleCase(notification.channel)}</Table.Td>
                      <Table.Td>{titleCase(notification.category)}</Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm">{notification.recipientName}</Text>
                          <Text size="xs" c="dimmed">
                            {notification.recipientAddress}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {notification.subject}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed">
              No external notifications have been queued yet.
            </Text>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
