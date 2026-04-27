import {
  Avatar,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronRight, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type { AdminMemberDirectoryEntry } from '~/lib/auth/members.server';

export interface AdminMembersPageProps {
  members: AdminMemberDirectoryEntry[];
}

function formatMemberDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

function matchesMember(member: AdminMemberDirectoryEntry, query: string) {
  if (!query) {
    return true;
  }

  const value = query.toLowerCase();
  return [
    member.name,
    member.email,
    member.nextTrip?.circuit,
    member.nextTrip?.provider,
    member.nextTrip?.accommodationName,
  ].some((field) => field?.toLowerCase().includes(value));
}

function MemberManagementRow({
  member,
}: {
  member: AdminMemberDirectoryEntry;
}) {
  const nextTrip = member.nextTrip
    ? `${formatMemberDate(member.nextTrip.date)} • ${member.nextTrip.circuit}`
    : 'No upcoming trips';

  return (
    <UnstyledButton
      component={Link}
      to={`/dashboard/admin/members/${member.id}`}
      style={{
        color: 'inherit',
        display: 'block',
        textDecoration: 'none',
        width: '100%',
      }}
    >
      <Group justify="space-between" align="center" gap="md" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap" style={{ flex: 1 }}>
          <Avatar src={member.picture} alt={member.name} radius="sm" size={42}>
            {member.name.charAt(0).toUpperCase()}
          </Avatar>

          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Text fw={700}>{member.name}</Text>
              <Text size="sm" c="dimmed">
                {member.email}
              </Text>
            </Group>

            <Text size="sm" c="dimmed">
              {nextTrip}
            </Text>

            <Group gap="md" wrap="wrap">
              <Text size="xs" c="dimmed">
                {member.activeTripsCount}{' '}
                {member.activeTripsCount === 1 ? 'active trip' : 'active trips'}
              </Text>
              <Text size="xs" c="dimmed">
                {member.sharedStayCount}{' '}
                {member.sharedStayCount === 1 ? 'shared stay' : 'shared stays'}
              </Text>
            </Group>
          </Stack>
        </Group>

        <ThemeIcon variant="light" color="brand" radius="sm" size={32}>
          <IconChevronRight size={18} />
        </ThemeIcon>
      </Group>
    </UnstyledButton>
  );
}

export function AdminMembersPage({ members }: AdminMembersPageProps) {
  const [query, setQuery] = useState('');
  const filteredMembers = useMemo(
    () => members.filter((member) => matchesMember(member, query.trim())),
    [members, query],
  );
  const membersWithTrips = members.filter(
    (member) => member.activeTripsCount > 0,
  );
  const totalSharedStays = members.reduce(
    (count, member) => count + member.sharedStayCount,
    0,
  );

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Admin"
        title="Member management"
        description="Review members, open their trip list, and manage race series subscriptions."
        meta={
          <HeaderStatGrid
            items={[
              { label: 'Members', value: members.length },
              { label: 'With trips', value: membersWithTrips.length },
              { label: 'Shared stays', value: totalSharedStays },
            ]}
          />
        }
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <TextInput
            label="Search members"
            placeholder="Search by name, email, circuit, or stay"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
          />

          {filteredMembers.length > 0 ? (
            <Stack gap="md">
              {filteredMembers.map((member, index) => (
                <Stack key={member.id} gap="md">
                  <MemberManagementRow member={member} />
                  {index < filteredMembers.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          ) : (
            <Stack gap={4} align="center" py="xl">
              <Text fw={700}>No members match that search</Text>
              <Text size="sm" c="dimmed" ta="center">
                Try a different name, email, trip, or stay.
              </Text>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
