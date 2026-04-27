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
import type { AvailableDay } from '~/lib/days/types';
import type { UserDayNotification } from '~/lib/db/services/day-notification.server';

export interface NotificationsPageProps {
  notifications: UserDayNotification[];
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
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function dayHref(dayId: string) {
  return `/dashboard/days?day=${encodeURIComponent(dayId)}`;
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
                <Badge color="brand">New</Badge>
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

export function NotificationsPage({ notifications }: NotificationsPageProps) {
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

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

      {notifications.length === 0 ? (
        <EmptyStateCard
          title="No day notifications yet"
          description="When a new race day, test day, or track day appears in the calendar, it will be listed here."
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
                    {unreadCount === 0
                      ? 'Everything here has been read.'
                      : `${unreadCount} unread ${unreadCount === 1 ? 'day' : 'days'}.`}
                  </Text>
                </Stack>
              </Group>
            </Group>

            <Stack gap="md">
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
