import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCircleCheck,
  IconHistory,
  IconMessageCircle,
} from '@tabler/icons-react';
import { Form, useNavigation } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type { FeedbackActionResult, FeedbackThread } from '~/lib/db/services/feedback.server';

export interface FeedbackPageProps {
  actionData?: FeedbackActionResult;
  feedback: FeedbackThread[];
}

const feedbackTypeOptions = [
  { value: 'feature_request', label: 'Feature request' },
  { value: 'feedback', label: 'General feedback' },
  { value: 'bug_report', label: 'Something is not working' },
];

function getFieldValues(actionData: FeedbackActionResult | undefined) {
  return actionData && !actionData.ok ? actionData.values : undefined;
}

function getTypeDefault(value: string | undefined) {
  return feedbackTypeOptions.some((option) => option.value === value) ? value : 'feature_request';
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function typeColor(type: FeedbackThread['type']) {
  switch (type) {
    case 'feature_request':
      return 'brand';
    case 'bug_report':
      return 'red';
    case 'feedback':
      return 'blue';
  }
}

function statusColor(status: FeedbackThread['status']) {
  switch (status) {
    case 'new':
      return 'gray';
    case 'reviewed':
      return 'blue';
    case 'planned':
      return 'yellow';
    case 'closed':
      return 'green';
  }
}

function formatStatus(status: FeedbackThread['status']) {
  if (status === 'closed') {
    return 'Done';
  }

  return titleCase(status);
}

function FeedbackTimeline({ item }: { item: FeedbackThread }) {
  if (item.adminUpdates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No admin updates yet.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {item.adminUpdates.map((update) => (
        <Paper key={update.updateId} withBorder p="sm">
          <Stack gap="xs">
            <Group gap="xs" wrap="wrap">
              <Badge color={statusColor(update.status)} variant="light">
                {formatStatus(update.status)}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatTimestamp(update.createdAt)}
              </Text>
              {update.authorName ? (
                <Text size="xs" c="dimmed">
                  {update.authorName}
                </Text>
              ) : null}
            </Group>
            <Text size="sm">{update.message}</Text>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function FeedbackHistoryItem({ item, isLast }: { item: FeedbackThread; isLast: boolean }) {
  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <Text fw={800}>{item.title}</Text>
          <Badge color={typeColor(item.type)} variant="light">
            {titleCase(item.type)}
          </Badge>
          <Badge color={statusColor(item.status)} variant="light">
            {formatStatus(item.status)}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Submitted {formatTimestamp(item.createdAt)}
        </Text>
        <Text size="sm">{item.message}</Text>
        {item.context ? (
          <Text size="sm" c="dimmed">
            Context: {item.context}
          </Text>
        ) : null}
      </Stack>

      <Stack gap="xs">
        <Text fw={700} size="sm">
          Admin updates
        </Text>
        <FeedbackTimeline item={item} />
      </Stack>

      {!isLast ? <Divider /> : null}
    </Stack>
  );
}

export function FeedbackPage({ actionData, feedback }: FeedbackPageProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const values = getFieldValues(actionData);
  const fieldErrors = actionData && !actionData.ok ? actionData.fieldErrors : undefined;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Feedback"
        title="Send feedback"
        description="Share an idea, request a feature, or tell us where something is not working."
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Stack gap={2}>
            <ThemeIcon size={42} radius="sm" color="brand" variant="light">
              <IconMessageCircle size={22} />
            </ThemeIcon>
            <Title order={2} fz="h3">
              What should change?
            </Title>
            <Text size="sm" c="dimmed">
              Requests go to the site admins with your account details attached so they can follow
              up if needed.
            </Text>
          </Stack>

          {actionData?.ok ? (
            <Alert color="green" icon={<IconCircleCheck size={18} />}>
              {actionData.message}
            </Alert>
          ) : null}
          {actionData && !actionData.ok ? (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {actionData.formError}
            </Alert>
          ) : null}

          <Form method="post">
            <Stack gap="md">
              <Select
                name="type"
                label="Request type"
                data={feedbackTypeOptions}
                defaultValue={getTypeDefault(values?.type)}
                error={fieldErrors?.type?.[0]}
                required
              />
              <TextInput
                name="title"
                label="Short title"
                placeholder="Add calendar filtering by championship"
                defaultValue={values?.title ?? ''}
                error={fieldErrors?.title?.[0]}
                required
              />
              <Textarea
                name="message"
                label="Details"
                placeholder="What are you trying to do, and what would make it easier?"
                defaultValue={values?.message ?? ''}
                error={fieldErrors?.message?.[0]}
                minRows={5}
                required
              />
              <TextInput
                name="context"
                label="Relevant page or workflow"
                placeholder="Available Days, Members, My Bookings"
                defaultValue={values?.context ?? ''}
                error={fieldErrors?.context?.[0]}
              />
              <Button
                type="submit"
                leftSection={<IconMessageCircle size={18} />}
                loading={isSubmitting}
                fullWidth
              >
                Send feedback
              </Button>
            </Stack>
          </Form>
        </Stack>
      </Paper>

      {feedback.length === 0 ? (
        <EmptyStateCard
          title="No feedback sent yet"
          description="Feedback you send from this page will appear here with any admin updates."
        />
      ) : (
        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="lg">
            <Stack gap={2}>
              <ThemeIcon size={42} radius="sm" color="brand" variant="light">
                <IconHistory size={22} />
              </ThemeIcon>
              <Title order={2} fz="h3">
                Your feedback
              </Title>
              <Text size="sm" c="dimmed">
                Track the current status and any replies from the admin team.
              </Text>
            </Stack>

            <Stack gap="md">
              {feedback.map((item, index) => (
                <FeedbackHistoryItem
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
