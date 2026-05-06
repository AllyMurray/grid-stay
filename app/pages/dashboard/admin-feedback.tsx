import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconBug,
  IconBulb,
  IconCircleCheck,
  IconDeviceFloppy,
  IconMessageCircle,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminFeedbackActionResult, FeedbackThread } from '~/lib/db/services/feedback.server';

export interface AdminFeedbackPageProps {
  feedback: FeedbackThread[];
}

type FeedbackFieldErrors = Extract<AdminFeedbackActionResult, { ok: false }>['fieldErrors'];

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

function getFieldError(
  fieldErrors: FeedbackFieldErrors | undefined,
  fieldName: keyof FeedbackFieldErrors,
) {
  return fieldErrors?.[fieldName]?.[0];
}

function FeedbackIcon({ type }: { type: FeedbackThread['type'] }) {
  if (type === 'feature_request') {
    return <IconBulb size={20} />;
  }
  if (type === 'bug_report') {
    return <IconBug size={20} />;
  }
  return <IconMessageCircle size={20} />;
}

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'planned', label: 'Planned' },
  { value: 'closed', label: 'Done' },
];

function FeedbackUpdateTimeline({ item }: { item: FeedbackThread }) {
  if (item.adminUpdates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No admin updates sent yet.
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

function FeedbackRow({ item, isLast }: { item: FeedbackThread; isLast: boolean }) {
  const fetcher = useFetcher<AdminFeedbackActionResult>();
  const [deleteModalOpened, { close: closeDeleteModal, open: openDeleteModal }] =
    useDisclosure(false);
  const currentIntent = fetcher.formData?.get('intent')?.toString();
  const isSubmitting = fetcher.state !== 'idle';
  const isSavingStatus = isSubmitting && currentIntent === 'saveStatus';
  const isSendingUpdate = isSubmitting && currentIntent === 'sendUpdate';
  const isDeleting = isSubmitting && currentIntent === 'deleteFeedback';
  const fieldErrors = fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;
  const formKey = `${item.feedbackId}:${item.updatedAt}`;

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok && fetcher.data.intent === 'deleteFeedback') {
      closeDeleteModal();
    }
  }, [closeDeleteModal, fetcher.data, fetcher.state]);

  return (
    <>
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Delete feedback?"
        centered
      >
        <fetcher.Form method="post">
          <input type="hidden" name="feedbackId" value={item.feedbackId} />
          <Stack gap="md">
            <Text size="sm">
              This permanently removes the feedback record and its admin update history.
            </Text>

            {formError ? (
              <Alert color="red" icon={<IconAlertCircle size={18} />}>
                {formError}
              </Alert>
            ) : null}

            <Group justify="flex-end" wrap="wrap">
              <Button type="button" variant="default" onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                name="intent"
                value="deleteFeedback"
                color="red"
                loading={isDeleting}
              >
                Delete feedback
              </Button>
            </Group>
          </Stack>
        </fetcher.Form>
      </Modal>

      <Stack gap="md">
        <Group align="flex-start" gap="sm" wrap="nowrap">
          <ThemeIcon size={38} radius="sm" color={typeColor(item.type)} variant="light">
            <FeedbackIcon type={item.type} />
          </ThemeIcon>
          <Stack gap="xs" style={{ minWidth: 0, flex: 1 }}>
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
              {item.userName} · {item.userEmail} · {formatTimestamp(item.createdAt)}
            </Text>
            <Text size="sm">{item.message}</Text>
            {item.context ? (
              <Text size="sm" c="dimmed">
                Context: {item.context}
              </Text>
            ) : null}
          </Stack>
        </Group>

        {success ? (
          <Alert color="green" icon={<IconCircleCheck size={18} />}>
            {success.message}
          </Alert>
        ) : null}
        {success?.ok && 'warning' in success && success.warning ? (
          <Alert color="yellow" variant="light">
            {success.warning}
          </Alert>
        ) : null}
        {formError ? (
          <Alert color="red" icon={<IconAlertCircle size={18} />}>
            {formError}
          </Alert>
        ) : null}

        <fetcher.Form method="post" key={formKey}>
          <input type="hidden" name="feedbackId" value={item.feedbackId} />
          <Stack gap="md">
            <Select
              name="status"
              label="Status"
              data={statusOptions}
              defaultValue={item.status}
              error={getFieldError(fieldErrors, 'status')}
            />
            <Textarea
              name="message"
              label="Member update"
              placeholder="Explain what changed, what is planned, or what has been completed."
              minRows={3}
              error={getFieldError(fieldErrors, 'message')}
            />
            <Group justify="space-between" gap="sm" wrap="wrap">
              <Button
                type="button"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={openDeleteModal}
              >
                Delete
              </Button>
              <Group gap="sm" wrap="wrap">
                <Button
                  type="submit"
                  name="intent"
                  value="saveStatus"
                  variant="default"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={isSavingStatus}
                >
                  Save status
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="sendUpdate"
                  leftSection={<IconMessageCircle size={16} />}
                  loading={isSendingUpdate}
                >
                  Send update
                </Button>
              </Group>
            </Group>
          </Stack>
        </fetcher.Form>

        <Stack gap="xs">
          <Text fw={700} size="sm">
            Admin updates
          </Text>
          <FeedbackUpdateTimeline item={item} />
        </Stack>

        {!isLast ? <Divider /> : null}
      </Stack>
    </>
  );
}

export function AdminFeedbackPage({ feedback }: AdminFeedbackPageProps) {
  const featureRequestCount = feedback.filter((item) => item.type === 'feature_request').length;
  const bugReportCount = feedback.filter((item) => item.type === 'bug_report').length;
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
