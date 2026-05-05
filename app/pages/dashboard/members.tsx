import {
  Alert,
  Avatar,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconMail, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { EmptyStateCard } from '~/components/layout/empty-state-card';
import { PageHeader } from '~/components/layout/page-header';
import type {
  MemberInviteActionResult,
  MemberInviteSummary,
} from '~/lib/auth/member-invites.server';
import type { MemberDirectoryEntry } from '~/lib/auth/members.server';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import { formatDateOnly } from '~/lib/dates/date-only';

export interface MembersPageProps {
  members: MemberDirectoryEntry[];
  pendingInvites: MemberInviteSummary[];
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
          {member.activeTripsCount}{' '}
          {member.activeTripsCount === 1 ? 'active trip' : 'active trips'}
        </Text>
        <Text size="xs" c="dimmed">
          {member.sharedStayCount}{' '}
          {member.sharedStayCount === 1 ? 'accommodation' : 'accommodations'}
        </Text>
        <Text size="xs" c="dimmed">
          Accommodation • {getStaySummary(member)}
        </Text>
        <Button
          component={Link}
          to={`/dashboard/members/${member.id}`}
          size="xs"
          variant="default"
        >
          View days
        </Button>
      </Group>
    </Stack>
  );
}

function MemberInvitePanel({
  pendingInvites,
}: {
  pendingInvites: MemberInviteSummary[];
}) {
  const fetcher = useFetcher<MemberInviteActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700}>Invite a member</Text>
          <Text size="sm" c="dimmed">
            Add their email address, then they can sign in and join the shared
            planner.
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
              Pending invites
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
                        Invited by {invite.invitedByName} • Expires{' '}
                        {formatInviteDate(invite.expiresAt)}
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      <fetcher.Form method="post">
                        <input
                          type="hidden"
                          name="email"
                          value={invite.inviteEmail}
                        />
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
                        <input
                          type="hidden"
                          name="email"
                          value={invite.inviteEmail}
                        />
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

export function MembersPage({ members, pendingInvites }: MembersPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const filteredMembers = useMemo(
    () =>
      members.filter((member) =>
        matchesMemberQuery(member, searchQuery.trim()),
      ),
    [members, searchQuery],
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Members"
        title="Site members"
        description="See who is on the site, invite new members, and check who already has accommodation plans in play."
      />

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
