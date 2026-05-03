import {
  Badge,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconBug, IconBulb, IconMessageCircle } from '@tabler/icons-react';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { FeedbackRecord } from '~/lib/db/entities/feedback.server';

export interface AdminFeedbackPageProps {
  feedback: FeedbackRecord[];
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function typeColor(type: FeedbackRecord['type']) {
  switch (type) {
    case 'feature_request':
      return 'brand';
    case 'bug_report':
      return 'red';
    case 'feedback':
      return 'blue';
  }
}

function FeedbackIcon({ type }: { type: FeedbackRecord['type'] }) {
  if (type === 'feature_request') {
    return <IconBulb size={20} />;
  }
  if (type === 'bug_report') {
    return <IconBug size={20} />;
  }
  return <IconMessageCircle size={20} />;
}

function FeedbackRow({
  item,
  isLast,
}: {
  item: FeedbackRecord;
  isLast: boolean;
}) {
  return (
    <Stack gap="md">
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <ThemeIcon
          size={38}
          radius="sm"
          color={typeColor(item.type)}
          variant="light"
        >
          <FeedbackIcon type={item.type} />
        </ThemeIcon>
        <Stack gap="xs" style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={800}>{item.title}</Text>
            <Badge color={typeColor(item.type)} variant="light">
              {titleCase(item.type)}
            </Badge>
            <Badge color="gray" variant="light">
              {titleCase(item.status)}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {item.userName} · {item.userEmail} ·{' '}
            {formatTimestamp(item.createdAt)}
          </Text>
          <Text size="sm">{item.message}</Text>
          {item.context ? (
            <Text size="sm" c="dimmed">
              Context: {item.context}
            </Text>
          ) : null}
        </Stack>
      </Group>
      {!isLast ? <Divider /> : null}
    </Stack>
  );
}

export function AdminFeedbackPage({ feedback }: AdminFeedbackPageProps) {
  const featureRequestCount = feedback.filter(
    (item) => item.type === 'feature_request',
  ).length;
  const bugReportCount = feedback.filter(
    (item) => item.type === 'bug_report',
  ).length;
  const newCount = feedback.filter((item) => item.status === 'new').length;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Feedback"
        description="Review feedback and feature requests submitted by members."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Total', value: feedback.length },
              { label: 'New', value: newCount },
              { label: 'Feature requests', value: featureRequestCount },
              { label: 'Bug reports', value: bugReportCount },
            ]}
          />
        }
      />

      {feedback.length === 0 ? (
        <EmptyStateCard
          title="No feedback yet"
          description="Member feedback and feature requests will appear here after they are submitted."
        />
      ) : (
        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="lg">
            <Stack gap={2}>
              <Title order={2} fz="h3">
                Latest submissions
              </Title>
              <Text size="sm" c="dimmed">
                Showing the latest feedback records first.
              </Text>
            </Stack>

            <Stack gap="md">
              {feedback.map((item, index) => (
                <FeedbackRow
                  key={item.feedbackId}
                  item={item}
                  isLast={index === feedback.length - 1}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
