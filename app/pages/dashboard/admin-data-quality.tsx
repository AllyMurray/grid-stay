import {
  Badge,
  Button,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  DataQualityIssue,
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
  return issue.severity === 'warning' ? 'yellow' : 'blue';
}

export function AdminDataQualityPage({
  refreshedAt,
  dayCount,
  issueCount,
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
              { label: 'Issues found', value: issueCount },
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
              <Table striped highlightOnHover miw={860}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Circuit</Table.Th>
                    <Table.Th>Provider</Table.Th>
                    <Table.Th>Message</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {issues.map((issue) => (
                    <Table.Tr key={`${issue.dayId}:${issue.type}`}>
                      <Table.Td>
                        <Badge color={issueColor(issue)} variant="light">
                          {formatIssueType(issue.type)}
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
