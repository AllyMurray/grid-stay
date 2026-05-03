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
import {
  IconBellRinging,
  IconCalendarPlus,
  IconCircleCheck,
} from '@tabler/icons-react';
import { Form, Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { AvailableDay } from '~/lib/days/types';
import type { UserDayNotification } from '~/lib/db/services/day-notification.server';
import type { GarageShareRequestRecord } from '~/lib/db/services/garage-sharing.server';

export interface NotificationsPageProps {
  notifications: UserDayNotification[];
  garageShareRequests: GarageShareRequestRecord[];
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function typeColor(type: AvailableDay['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
  }
}

function formatNotificationDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function dayHref(dayId: string) {
  return `/dashboard/days?day=${encodeURIComponent(dayId)}`;
}

function notificationTypeLabel(type: UserDayNotification['type']) {
  return type === 'changed_available_day' ? 'Changed' : 'New';
}

function NotificationRow({
  notification,
  isLast,
}: {
  notification: UserDayNotification;
  isLast: boolean;
}) {
  return (
    <Stack gap="md">
      <Group align="flex-start" justify="space-between" gap="lg" wrap="nowrap">
        <Group
          align="flex-start"
          gap="sm"
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          <ThemeIcon
            size={38}
            radius="sm"
            color={notification.isRead ? 'gray' : 'brand'}
            variant="light"
          >
            {notification.isRead ? (
              <IconCircleCheck size={20} />
            ) : (
              <IconCalendarPlus size={20} />
            )}
          </ThemeIcon>
          <Stack gap={6} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={800}>{notification.circuit}</Text>
              <Badge color={typeColor(notification.dayType)}>
                {titleCase(notification.dayType)}
              </Badge>
              {notification.isRead ? (
                <Badge color="gray">Read</Badge>
              ) : (
                <Badge color="brand">
                  {notificationTypeLabel(notification.type)}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {formatNotificationDate(notification.date)} •{' '}
              {notification.provider}
            </Text>
            <Text size="sm">
              {notification.description || 'No extra details'}
            </Text>
          </Stack>
        </Group>

        <Button
          component={Link}
          to={dayHref(notification.dayId)}
          variant={notification.isRead ? 'default' : 'filled'}
          flex="0 0 auto"
        >
          Open day
        </Button>
      </Group>
      {!isLast ? <Divider /> : null}
    </Stack>
  );
}

function GarageShareRequestRow({
  request,
  isLast,
}: {
  request: GarageShareRequestRecord;
  isLast: boolean;
}) {
  return (
    <Stack gap="md">
      <Group align="flex-start" justify="space-between" gap="lg" wrap="nowrap">
        <Group
          align="flex-start"
          gap="sm"
          wrap="nowrap"
          style={{ minWidth: 0 }}
        >
          <ThemeIcon size={38} radius="sm" color="orange" variant="light">
            <IconBellRinging size={20} />
          </ThemeIcon>
          <Stack gap={6} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={800}>{request.requesterName}</Text>
              <Badge color="orange">Garage request</Badge>
              <Badge color="gray">{request.circuit}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {formatNotificationDate(request.date)} • {request.provider}
            </Text>
            <Text size="sm">
              Wants to share your garage for{' '}
              {request.description || request.circuit}.
            </Text>
          </Stack>
        </Group>

        <Group gap="xs" justify="flex-end" flex="0 0 auto">
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="updateGarageShareRequest"
            />
            <input type="hidden" name="requestId" value={request.requestId} />
            <Button
              type="submit"
              name="status"
              value="declined"
              variant="default"
            >
              Decline
            </Button>
          </Form>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="updateGarageShareRequest"
            />
            <input type="hidden" name="requestId" value={request.requestId} />
            <Button type="submit" name="status" value="approved">
              Approve
            </Button>
          </Form>
        </Group>
      </Group>
      {!isLast ? <Divider /> : null}
    </Stack>
  );
}

export function NotificationsPage({
  notifications,
  garageShareRequests,
}: NotificationsPageProps) {
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;
  const pendingRequestCount = garageShareRequests.length;
  const hasItems = notifications.length > 0 || pendingRequestCount > 0;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Notifications"
        title="New available days"
        description="New dates found by the daily refresh or added manually by an admin."
        actions={
          notifications.length > 0 ? (
            <Form method="post">
              <input type="hidden" name="intent" value="markAllRead" />
              <Button
                type="submit"
                variant="default"
                disabled={unreadCount === 0}
              >
                Mark all read
              </Button>
            </Form>
          ) : null
        }
      />

      {!hasItems ? (
        <EmptyStateCard
          title="No day notifications yet"
          description="When a new day appears or someone asks to share your garage, it will be listed here."
          action={
            <Button component={Link} to="/dashboard/days">
              Open available days
            </Button>
          }
        />
      ) : (
        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start" gap="md">
              <Group gap="sm" align="center">
                <ThemeIcon size={38} radius="sm" color="brand" variant="light">
                  <IconBellRinging size={20} />
                </ThemeIcon>
                <Stack gap={2}>
                  <Title order={3}>Latest changes</Title>
                  <Text size="sm" c="dimmed">
                    {pendingRequestCount > 0
                      ? `${pendingRequestCount} pending garage ${pendingRequestCount === 1 ? 'request' : 'requests'}.`
                      : unreadCount === 0
                        ? 'Everything here has been read.'
                        : `${unreadCount} unread ${unreadCount === 1 ? 'day' : 'days'}.`}
                  </Text>
                </Stack>
              </Group>
            </Group>

            <Stack gap="md">
              {garageShareRequests.map((request, index) => (
                <GarageShareRequestRow
                  key={request.requestId}
                  request={request}
                  isLast={
                    index === garageShareRequests.length - 1 &&
                    notifications.length === 0
                  }
                />
              ))}
              {notifications.map((notification, index) => (
                <NotificationRow
                  key={notification.notificationId}
                  notification={notification}
                  isLast={index === notifications.length - 1}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
