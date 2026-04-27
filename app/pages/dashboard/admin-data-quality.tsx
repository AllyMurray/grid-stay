import {
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { Link, useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  DataQualityIssue,
  DataQualityIssueStateActionResult,
  DaysDataQualityReport,
} from '~/lib/days/data-quality.server';

export type AdminDataQualityPageProps = DaysDataQualityReport;

function formatRefreshedAt(value: string) {
  if (!value) {
    return 'Waiting for the first refresh';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatIssueType(type: DataQualityIssue['type']) {
  return type.replace(/_/g, ' ');
}

function issueColor(issue: DataQualityIssue) {
  if (issue.status === 'resolved') {
    return 'green';
  }

  if (issue.status === 'ignored') {
    return 'gray';
  }

  return issue.severity === 'warning' ? 'yellow' : 'blue';
}

function statusColor(status: DataQualityIssue['status']) {
  switch (status) {
    case 'open':
      return 'yellow';
    case 'ignored':
      return 'gray';
    case 'resolved':
      return 'green';
  }
}

function IssueActions({ issue }: { issue: DataQualityIssue }) {
  const fetcher = useFetcher<DataQualityIssueStateActionResult>();
  const isSubmitting = fetcher.state !== 'idle';

  if (issue.status !== 'open') {
    return (
      <Stack gap={4}>
        {issue.stateNote ? (
          <Text size="xs" c="dimmed">
            {issue.stateNote}
          </Text>
        ) : null}
        <fetcher.Form method="post">
          <input type="hidden" name="issueId" value={issue.issueId} />
          <Button
            type="submit"
            name="intent"
            value="reopenIssue"
            size="xs"
            variant="default"
            loading={isSubmitting}
          >
            Reopen
          </Button>
        </fetcher.Form>
      </Stack>
    );
  }

  return (
    <fetcher.Form method="post">
      <Stack gap="xs">
        <input type="hidden" name="issueId" value={issue.issueId} />
        <TextInput
          name="note"
          placeholder="Optional note"
          aria-label={`Note for ${issue.issueId}`}
          size="xs"
        />
        <Group gap="xs" wrap="nowrap">
          <Button
            type="submit"
            name="intent"
            value="ignoreIssue"
            size="xs"
            variant="default"
            loading={isSubmitting}
          >
            Ignore
          </Button>
          <Button
            type="submit"
            name="intent"
            value="resolveIssue"
            size="xs"
            variant="default"
            color="green"
            loading={isSubmitting}
          >
            Resolve
          </Button>
        </Group>
      </Stack>
    </fetcher.Form>
  );
}

export function AdminDataQualityPage({
  refreshedAt,
  dayCount,
  issueCount,
  openIssueCount,
  ignoredIssueCount,
  resolvedIssueCount,
  issues,
}: AdminDataQualityPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Data quality"
        description="Review normalized day data before it becomes a member-facing problem."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Days checked', value: dayCount },
              { label: 'Open issues', value: openIssueCount ?? issueCount },
              { label: 'Ignored', value: ignoredIssueCount ?? 0 },
              { label: 'Resolved', value: resolvedIssueCount ?? 0 },
              { label: 'Last refresh', value: formatRefreshedAt(refreshedAt) },
            ]}
          />
        }
        actions={
          <Button component={Link} to="/dashboard/admin/feed" variant="default">
            Open feed status
          </Button>
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <Stack gap={2}>
            <Title order={3}>Available-days checks</Title>
            <Text size="sm" c="dimmed">
              Last refresh {formatRefreshedAt(refreshedAt)}
            </Text>
          </Stack>

          {issues.length === 0 ? (
            <Stack gap="xs" align="flex-start">
              <Badge color="green" leftSection={<IconCircleCheck size={14} />}>
                No issues found
              </Badge>
              <Text size="sm" c="dimmed">
                All checked days have canonical circuit data and no obvious
                duplicate normalized identities.
              </Text>
            </Stack>
          ) : (
            <ScrollArea>
              <Table striped highlightOnHover miw={1120}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Circuit</Table.Th>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Message</Table.Th>
                    <Table.Th>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {issues.map((issue) => (
                    <Table.Tr key={issue.issueId}>
                      <Table.Td>
                        <Badge color={issueColor(issue)} variant="light">
                          {formatIssueType(issue.type)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={statusColor(issue.status)}
                          variant="light"
                        >
                          {issue.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{issue.date}</Table.Td>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text size="sm" fw={700}>
                            {issue.circuit}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {issue.description || issue.dayId}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>{issue.provider}</Table.Td>
                      <Table.Td>{issue.message}</Table.Td>
                      <Table.Td>
                        <IssueActions issue={issue} />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
