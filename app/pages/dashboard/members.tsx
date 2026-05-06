import {
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconMail, IconSearch, IconTrophy } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type {
  MemberInviteActionResult,
  MemberInviteSummary,
} from '~/lib/auth/member-invites.server';
import type {
  MemberDateLeaderboardEntry,
  MemberDirectoryEntry,
} from '~/lib/auth/members.server';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import { formatDateOnly } from '~/lib/dates/date-only';

export interface MembersPageProps {
  members: MemberDirectoryEntry[];
  pendingInvites: MemberInviteSummary[];
  leaderboard: MemberDateLeaderboardEntry[];
}

function formatMemberDate(value: string) {
  return formatDateOnly(value, {
    day: 'numeric',
    month: 'short',
  });
}

function formatInviteDate(value: string | undefined) {
  return value
    ? formatDateOnly(value.slice(0, 10), {
        day: 'numeric',
        month: 'short',
      })
    : 'No expiry';
}

function getNextTripSummary(member: MemberDirectoryEntry) {
  if (!member.nextTrip) {
    return 'No upcoming trips yet';
  }

  return `${formatMemberDate(member.nextTrip.date)} • ${member.nextTrip.circuit} • ${member.nextTrip.provider}`;
}

function getStaySummary(member: MemberDirectoryEntry) {
  if (!member.nextTrip) {
    return 'No accommodation plan on the next trip yet';
  }

  return getAccommodationPlanSummary(member.nextTrip);
}

function matchesMemberQuery(member: MemberDirectoryEntry, query: string) {
  if (!query) {
    return true;
  }

  const value = query.toLowerCase();
  return [
    member.name,
    member.nextTrip?.circuit,
    member.nextTrip?.provider,
    member.nextTrip?.accommodationName,
    member.nextTrip ? getAccommodationPlanSummary(member.nextTrip) : undefined,
  ].some((field) => field?.toLowerCase().includes(value));
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

function MemberDateLeaderboardPanel({
  leaderboard,
}: {
  leaderboard: MemberDateLeaderboardEntry[];
}) {
  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" gap="md" align="flex-start">
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon radius="sm" variant="light" color="brand">
              <IconTrophy size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={700}>Most dates</Text>
              <Text size="sm" c="dimmed">
                Confirmed race, test, and track days across the group.
              </Text>
            </Stack>
          </Group>
        </Group>

        {leaderboard.length > 0 ? (
          <Stack gap="sm">
            {leaderboard.map((entry, index) => (
              <Stack key={entry.id} gap="sm">
                <Group justify="space-between" gap="md" align="center" wrap="wrap">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text fw={800} c="dimmed" w={28} ta="center">
                      {index + 1}
                    </Text>
                    <Avatar src={entry.picture} alt={entry.name} radius="sm" size={36}>
                      {entry.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fw={700} truncate>
                        {entry.name}
                      </Text>
                      <Group gap={6} wrap="wrap">
                        <LeaderboardCountBadge
                          label="Track"
                          value={entry.trackDayCount}
                          color="orange"
                        />
                        <LeaderboardCountBadge label="Test" value={entry.testDayCount} color="blue" />
                        <LeaderboardCountBadge
                          label="Race"
                          value={entry.raceDayCount}
                          color="brand"
                        />
                      </Group>
                    </Stack>
                  </Group>

                  <Group gap="sm" wrap="nowrap">
                    <Text fw={800} ta="right">
                      {formatDateCount(entry.totalCount)}
                    </Text>
                    <Button
                      component={Link}
                      to={`/dashboard/members/${entry.id}`}
                      size="xs"
                      variant="default"
                    >
                      Open days
                    </Button>
                  </Group>
                </Group>
                {index < leaderboard.length - 1 ? <Divider /> : null}
              </Stack>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No confirmed race, test, or track days have been booked yet.
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

function MemberRow({ member }: { member: MemberDirectoryEntry }) {
  return (
    <Stack gap="sm">
      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1 }}>
        <Avatar src={member.picture} alt={member.name} radius="sm" size={40}>
          {member.name.charAt(0).toUpperCase()}
        </Avatar>

        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700}>{member.name}</Text>

          <Text size="sm" c="dimmed">
            {getNextTripSummary(member)}
          </Text>
        </Stack>
      </Group>

      <Group gap="md" wrap="wrap">
        <Text size="xs" c="dimmed">
          {member.activeTripsCount} {member.activeTripsCount === 1 ? 'active trip' : 'active trips'}
        </Text>
        <Text size="xs" c="dimmed">
          {member.sharedStayCount}{' '}
          {member.sharedStayCount === 1 ? 'accommodation' : 'accommodations'}
        </Text>
        <Text size="xs" c="dimmed">
          Accommodation • {getStaySummary(member)}
        </Text>
        <Button component={Link} to={`/dashboard/members/${member.id}`} size="xs" variant="default">
          View days
        </Button>
      </Group>
    </Stack>
  );
}

function MemberInvitePanel({ pendingInvites }: { pendingInvites: MemberInviteSummary[] }) {
  const fetcher = useFetcher<MemberInviteActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors = fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700}>Invite a member</Text>
          <Text size="sm" c="dimmed">
            Add their email address, then they can sign in and join the shared planner.
          </Text>
        </Stack>

        <fetcher.Form method="post">
          <Group align="flex-start" gap="sm">
            <TextInput
              name="email"
              type="email"
              label="Email address"
              placeholder="driver@example.com"
              leftSection={<IconMail size={16} />}
              error={fieldErrors?.email?.[0]}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button type="submit" loading={isSubmitting} mt={24}>
              Invite
            </Button>
          </Group>
        </fetcher.Form>

        {success ? (
          <Alert color="green" variant="light">
            {success.message}
          </Alert>
        ) : formError ? (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        ) : null}

        {pendingInvites.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={700} c="dimmed">
              Your pending invites
            </Text>
            <Stack gap={0}>
              {pendingInvites.map((invite, index) => (
                <Stack key={invite.inviteEmail} gap="xs">
                  <Group justify="space-between" gap="md" wrap="wrap">
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>
                        {invite.inviteEmail}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Expires {formatInviteDate(invite.expiresAt)}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <fetcher.Form method="post">
                        <input type="hidden" name="email" value={invite.inviteEmail} />
                        <Button
                          type="submit"
                          name="intent"
                          value="createInvite"
                          variant="default"
                          size="xs"
                          loading={isSubmitting}
                        >
                          Renew
                        </Button>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="email" value={invite.inviteEmail} />
                        <Button
                          type="submit"
                          name="intent"
                          value="revokeInvite"
                          variant="subtle"
                          color="red"
                          size="xs"
                          loading={isSubmitting}
                        >
                          Revoke
                        </Button>
                      </fetcher.Form>
                    </Group>
                  </Group>
                  {index < pendingInvites.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

export function MembersPage({ members, pendingInvites, leaderboard }: MembersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredMembers = useMemo(
    () => members.filter((member) => matchesMemberQuery(member, searchQuery.trim())),
    [members, searchQuery],
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Members"
        title="Site members"
        description="See who is on the site, invite new members, and check who already has accommodation plans in play."
      />

      <MemberDateLeaderboardPanel leaderboard={leaderboard} />

      <MemberInvitePanel pendingInvites={pendingInvites} />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <TextInput
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder="Search by name, circuit, or accommodation"
            label="Search members"
            leftSection={<IconSearch size={16} />}
          />

          {filteredMembers.length > 0 ? (
            <Stack gap="md">
              {filteredMembers.map((member, index) => (
                <Stack key={member.id} gap="md">
                  <MemberRow member={member} />
                  {index < filteredMembers.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyStateCard
              title="No members match that search"
              description="Try a different name, trip, or accommodation term."
            />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
