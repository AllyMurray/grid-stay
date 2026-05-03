import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconClipboardList,
  IconDownload,
  IconLock,
  IconMapPin,
  IconMessageCircle,
  IconRouteAltLeft,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';

interface AdminTool {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

interface AdminToolGroup {
  title: string;
  description: string;
  tools: AdminTool[];
}

const adminToolGroups: AdminToolGroup[] = [
  {
    title: 'Run the site',
    description: 'Start here when checking whether the app is healthy.',
    tools: [
      {
        title: 'Feed status',
        description: 'Review refresh health, source coverage, and feed errors.',
        href: '/dashboard/admin/feed',
        label: 'Monitoring',
        icon: IconActivityHeartbeat,
      },
      {
        title: 'Data quality',
        description: 'Triage source issues without exposing them to end users.',
        href: '/dashboard/admin/data-quality',
        label: 'Review',
        icon: IconAlertTriangle,
      },
      {
        title: 'Operations',
        description: 'Inspect recent audit, operational, and error events.',
        href: '/dashboard/admin/operations',
        label: 'Audit',
        icon: IconClipboardList,
      },
    ],
  },
  {
    title: 'Manage calendar data',
    description: 'Keep circuits, merges, and manually added days tidy.',
    tools: [
      {
        title: 'Manual days',
        description: 'Add track, test, or race days that are not in the feed.',
        href: '/dashboard/manual-days',
        label: 'Create',
        icon: IconLock,
      },
      {
        title: 'Circuit tools',
        description: 'Review aliases and canonical circuit labels.',
        href: '/dashboard/admin/circuits',
        label: 'Circuits',
        icon: IconMapPin,
      },
      {
        title: 'Day merges',
        description: 'Merge duplicate feed rows into a single shared day.',
        href: '/dashboard/admin/day-merges',
        label: 'Cleanup',
        icon: IconRouteAltLeft,
      },
    ],
  },
  {
    title: 'Members and records',
    description: 'Manage people and export operational data when needed.',
    tools: [
      {
        title: 'Member management',
        description: 'Review members, roles, invites, and series assignment.',
        href: '/dashboard/admin/members',
        label: 'People',
        icon: IconUsersGroup,
      },
      {
        title: 'Data export',
        description: 'Download a current JSON export for backup or review.',
        href: '/dashboard/admin/export',
        label: 'Export',
        icon: IconDownload,
      },
      {
        title: 'Feedback',
        description: 'Review feedback and feature requests from members.',
        href: '/dashboard/admin/feedback',
        label: 'Requests',
        icon: IconMessageCircle,
      },
    ],
  },
];

function AdminToolCard({ tool }: { tool: AdminTool }) {
  const Icon = tool.icon;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md" h="100%">
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <ThemeIcon size={40} radius="sm" color="brand" variant="light">
            <Icon size={21} />
          </ThemeIcon>
          <Stack gap={6} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Title order={3} fz="h4">
                {tool.title}
              </Title>
              <Badge color="brand" variant="light">
                {tool.label}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {tool.description}
            </Text>
          </Stack>
        </Group>

        <Button
          component={Link}
          to={tool.href}
          variant="default"
          fullWidth
          aria-label={`Open ${tool.title}`}
        >
          Open
        </Button>
      </Stack>
    </Paper>
  );
}

export function AdminDashboardPage() {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Admin dashboard"
        description="One place to reach the operational tools without carrying every admin page in the main navigation."
      />

      <Stack gap="xl">
        {adminToolGroups.map((group) => (
          <Stack key={group.title} gap="md">
            <Stack gap={4}>
              <Title order={2} fz="h3">
                {group.title}
              </Title>
              <Text size="sm" c="dimmed">
                {group.description}
              </Text>
            </Stack>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {group.tools.map((tool) => (
                <AdminToolCard key={tool.href} tool={tool} />
              ))}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
