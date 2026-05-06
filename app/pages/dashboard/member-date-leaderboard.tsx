import {
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconTrophy } from '@tabler/icons-react';
import { Link } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type { MemberDateLeaderboardEntry } from '~/lib/auth/members.server';

export interface MemberDateLeaderboardPageProps {
  leaderboard: MemberDateLeaderboardEntry[];
}

function formatDateCount(count: number) {
  return `${count} ${count === 1 ? 'date' : 'dates'}`;
}

function LeaderboardCountBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Badge variant="light" color={color} radius="sm">
      {label} {value}
    </Badge>
  );
}

function LeaderboardRow({
  entry,
  index,
}: {
  entry: MemberDateLeaderboardEntry;
  index: number;
}) {
  return (
    <Group justify="space-between" gap="md" align="center" wrap="wrap">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Text fw={800} c="dimmed" w={28} ta="center">
          {index + 1}
        </Text>
        <Avatar src={entry.picture} alt={entry.name} radius="sm" size={40}>
          {entry.name.charAt(0).toUpperCase()}
        </Avatar>
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text fw={700} truncate>
            {entry.name}
          </Text>
          <Group gap={6} wrap="wrap">
            <LeaderboardCountBadge label="Track" value={entry.trackDayCount} color="orange" />
            <LeaderboardCountBadge label="Test" value={entry.testDayCount} color="blue" />
            <LeaderboardCountBadge label="Race" value={entry.raceDayCount} color="brand" />
          </Group>
        </Stack>
      </Group>

      <Group gap="sm" wrap="nowrap">
        <Text fw={800} ta="right">
          {formatDateCount(entry.totalCount)}
        </Text>
        <Button component={Link} to={`/dashboard/members/${entry.id}`} size="xs" variant="default">
          Open days
        </Button>
      </Group>
    </Group>
  );
}

export function MemberDateLeaderboardPage({ leaderboard }: MemberDateLeaderboardPageProps) {
  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Members"
        title="Most dates"
        description="Confirmed race, test, and track days across the group."
        actions={
          <Button component={Link} to="/dashboard/members" variant="default">
            Back to members
          </Button>
        }
      />

      {leaderboard.length > 0 ? (
        <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
          <Stack gap="md">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon radius="sm" variant="light" color="brand">
                <IconTrophy size={18} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={700}>Group ranking</Text>
                <Text size="sm" c="dimmed">
                  Ranked by confirmed booked dates.
                </Text>
              </Stack>
            </Group>

            <Stack gap="sm">
              {leaderboard.map((entry, index) => (
                <Stack key={entry.id} gap="sm">
                  <LeaderboardRow entry={entry} index={index} />
                  {index < leaderboard.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : (
        <EmptyStateCard
          title="No confirmed dates yet"
          description="No confirmed race, test, or track days have been booked yet."
        />
      )}
    </Stack>
  );
}
