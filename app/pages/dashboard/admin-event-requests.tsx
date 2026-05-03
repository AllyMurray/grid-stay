import {
  Alert,
  Anchor,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import { formatDateOnly } from '~/lib/dates/date-only';
import type { EventRequestRecord } from '~/lib/db/entities/event-request.server';
import type { AdminEventRequestActionResult } from '~/lib/db/services/event-request.server';

export interface AdminEventRequestsPageProps {
  eventRequests: EventRequestRecord[];
}

type AdminEventRequestFieldErrors = Extract<
  AdminEventRequestActionResult,
  { ok: false }
>['fieldErrors'];

const typeOptions = [
  { value: 'track_day', label: 'Track day' },
  { value: 'test_day', label: 'Test day' },
  { value: 'race_day', label: 'Race day' },
  { value: 'road_drive', label: 'Road drive' },
];

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEventDate(value: string) {
  return formatDateOnly(value, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function typeColor(type: EventRequestRecord['type']) {
  switch (type) {
    case 'race_day':
      return 'brand';
    case 'test_day':
      return 'blue';
    case 'track_day':
      return 'orange';
    case 'road_drive':
      return 'teal';
  }
}

function statusColor(status: EventRequestRecord['status']) {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'approved':
      return 'green';
    case 'rejected':
      return 'gray';
  }
}

function getFieldError(
  fieldErrors: AdminEventRequestFieldErrors | undefined,
  fieldName: keyof AdminEventRequestFieldErrors,
) {
  return fieldErrors?.[fieldName]?.[0];
}

function buildApprovalDescription(request: EventRequestRecord) {
  const description = request.description?.trim()
    ? `${request.title}. ${request.description.trim()}`
    : request.title;
  return description.slice(0, 200);
}

function RequestStatusBadges({ request }: { request: EventRequestRecord }) {
  return (
    <Group gap="xs" wrap="wrap">
      <Badge color={statusColor(request.status)} variant="light">
        {titleCase(request.status)}
      </Badge>
      <Badge color={typeColor(request.type)} variant="light">
        {titleCase(request.type)}
      </Badge>
    </Group>
  );
}

function ReviewedRequestActions({ request }: { request: EventRequestRecord }) {
  if (request.status !== 'approved' || !request.approvedDayId) {
    return null;
  }

  return (
    <Button
      component={Link}
      to={`/dashboard/days?day=${encodeURIComponent(request.approvedDayId)}`}
      variant="default"
      size="sm"
    >
      Open calendar day
    </Button>
  );
}

function PendingRequestReview({ request }: { request: EventRequestRecord }) {
  const approveFetcher = useFetcher<AdminEventRequestActionResult>();
  const rejectFetcher = useFetcher<AdminEventRequestActionResult>();
  const approveFieldErrors =
    approveFetcher.data && !approveFetcher.data.ok
      ? approveFetcher.data.fieldErrors
      : undefined;
  const rejectFieldErrors =
    rejectFetcher.data && !rejectFetcher.data.ok
      ? rejectFetcher.data.fieldErrors
      : undefined;
  const approveError =
    approveFetcher.data && !approveFetcher.data.ok
      ? approveFetcher.data.formError
      : null;
  const rejectError =
    rejectFetcher.data && !rejectFetcher.data.ok
      ? rejectFetcher.data.formError
      : null;
  const approveSuccess = approveFetcher.data?.ok ? approveFetcher.data : null;
  const rejectSuccess = rejectFetcher.data?.ok ? rejectFetcher.data : null;

  return (
    <Stack gap="md">
      {approveSuccess ? (
        <Alert color="green">{approveSuccess.message}</Alert>
      ) : null}
      {rejectSuccess ? (
        <Alert color="green">{rejectSuccess.message}</Alert>
      ) : null}
      {approveError ? <Alert color="red">{approveError}</Alert> : null}
      {rejectError ? <Alert color="red">{rejectError}</Alert> : null}

      <approveFetcher.Form method="post">
        <Stack gap="md">
          <input type="hidden" name="intent" value="approveEventRequest" />
          <input type="hidden" name="requestId" value={request.requestId} />
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
            <TextInput
              name="date"
              label="Date"
              type="date"
              defaultValue={request.date}
              error={getFieldError(approveFieldErrors, 'date')}
            />
            <Select
              name="type"
              label="Type"
              data={typeOptions}
              defaultValue={request.type}
              allowDeselect={false}
              error={getFieldError(approveFieldErrors, 'type')}
            />
            <TextInput
              name="circuit"
              label="Calendar location"
              defaultValue={request.location}
              error={getFieldError(approveFieldErrors, 'circuit')}
            />
            <TextInput
              name="provider"
              label="Organiser"
              defaultValue={request.provider}
              error={getFieldError(approveFieldErrors, 'provider')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <TextInput
              name="series"
              label="Series"
              placeholder="Optional race series"
              error={getFieldError(approveFieldErrors, 'series')}
            />
            <TextInput
              name="bookingUrl"
              label="Booking or info link"
              defaultValue={request.bookingUrl ?? ''}
              error={getFieldError(approveFieldErrors, 'bookingUrl')}
            />
          </SimpleGrid>

          <Textarea
            name="description"
            label="Calendar description"
            defaultValue={buildApprovalDescription(request)}
            rows={3}
            error={getFieldError(approveFieldErrors, 'description')}
          />

          <Group justify="flex-end">
            <Button type="submit" loading={approveFetcher.state !== 'idle'}>
              Approve and add to calendar
            </Button>
          </Group>
        </Stack>
      </approveFetcher.Form>

      <rejectFetcher.Form method="post">
        <Stack gap="sm">
          <input type="hidden" name="intent" value="rejectEventRequest" />
          <input type="hidden" name="requestId" value={request.requestId} />
          <Textarea
            name="rejectionReason"
            label="Rejection note"
            placeholder="Optional internal note"
            rows={2}
            error={getFieldError(rejectFieldErrors, 'rejectionReason')}
          />
          <Group justify="flex-end">
            <Button
              type="submit"
              variant="subtle"
              color="red"
              loading={rejectFetcher.state !== 'idle'}
            >
              Reject request
            </Button>
          </Group>
        </Stack>
      </rejectFetcher.Form>
    </Stack>
  );
}

function EventRequestRow({
  request,
  isLast,
}: {
  request: EventRequestRecord;
  isLast: boolean;
}) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Title order={3} fz="h4">
              {request.title}
            </Title>
            <RequestStatusBadges request={request} />
          </Group>
          <Text size="sm" c="dimmed">
            {formatEventDate(request.date)} - {request.location} -{' '}
            {request.provider}
          </Text>
          <Text size="sm" c="dimmed">
            Submitted by {request.submittedByName} - {request.submittedByEmail}{' '}
            - {formatTimestamp(request.createdAt)}
          </Text>
          {request.description ? (
            <Text size="sm">{request.description}</Text>
          ) : null}
          {request.bookingUrl ? (
            <Anchor
              href={request.bookingUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              fw={700}
            >
              Open submitted link
            </Anchor>
          ) : null}
          {request.rejectionReason ? (
            <Text size="sm" c="dimmed">
              Rejection note: {request.rejectionReason}
            </Text>
          ) : null}
          {request.reviewedByName && request.reviewedAt ? (
            <Text size="xs" c="dimmed">
              Reviewed by {request.reviewedByName} -{' '}
              {formatTimestamp(request.reviewedAt)}
            </Text>
          ) : null}
        </Stack>

        <ReviewedRequestActions request={request} />
      </Group>

      {request.status === 'pending' ? (
        <PendingRequestReview request={request} />
      ) : null}

      {!isLast ? <Divider /> : null}
    </Stack>
  );
}

export function AdminEventRequestsPage({
  eventRequests,
}: AdminEventRequestsPageProps) {
  const pendingRequests = eventRequests.filter(
    (request) => request.status === 'pending',
  );
  const reviewedRequests = eventRequests.filter(
    (request) => request.status !== 'pending',
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Event requests"
        description="Review member-submitted track days, club days, and road drives before adding them to the shared calendar."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Pending', value: pendingRequests.length },
              {
                label: 'Approved',
                value: eventRequests.filter(
                  (request) => request.status === 'approved',
                ).length,
              },
              {
                label: 'Rejected',
                value: eventRequests.filter(
                  (request) => request.status === 'rejected',
                ).length,
              },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/admin" variant="default">
            Back to admin
          </Button>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Stack gap={2}>
            <Title order={2} fz="h3">
              Pending review
            </Title>
            <Text size="sm" c="dimmed">
              Approved requests become manual days immediately.
            </Text>
          </Stack>

          {pendingRequests.length > 0 ? (
            <Stack gap="lg">
              {pendingRequests.map((request, index) => (
                <EventRequestRow
                  key={request.requestId}
                  request={request}
                  isLast={index === pendingRequests.length - 1}
                />
              ))}
            </Stack>
          ) : (
            <EmptyStateCard
              title="No event requests pending"
              description="New member suggestions will appear here before they can enter the shared calendar."
            />
          )}
        </Stack>
      </Paper>

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Stack gap={2}>
            <Title order={2} fz="h3">
              Reviewed requests
            </Title>
            <Text size="sm" c="dimmed">
              Keep a record of what was approved or rejected.
            </Text>
          </Stack>

          {reviewedRequests.length > 0 ? (
            <Stack gap="lg">
              {reviewedRequests.map((request, index) => (
                <EventRequestRow
                  key={request.requestId}
                  request={request}
                  isLast={index === reviewedRequests.length - 1}
                />
              ))}
            </Stack>
          ) : (
            <EmptyStateCard
              title="No reviewed requests yet"
              description="Approved and rejected event requests will appear here."
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
