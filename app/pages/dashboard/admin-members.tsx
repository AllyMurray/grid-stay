import {
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronRight,
  IconCopy,
  IconLink,
  IconSearch,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useFetcher } from 'react-router';
import { HeaderStatGrid } from '~/components/layout/header-stat-grid';
import { PageHeader } from '~/components/layout/page-header';
import type {
  MemberJoinLinkActionResult,
  MemberJoinLinkMode,
  MemberJoinLinkState,
  MemberJoinLinkSummary,
} from '~/lib/auth/member-join-links.server';
import type { AdminMemberDirectoryEntry } from '~/lib/auth/members.server';
import { getAccommodationPlanSummary } from '~/lib/bookings/accommodation';
import { formatDateOnly } from '~/lib/dates/date-only';

export interface AdminMembersPageProps {
  members: AdminMemberDirectoryEntry[];
  joinLinks: MemberJoinLinkSummary[];
}

function formatMemberDate(value: string) {
  return formatDateOnly(value, {
    day: 'numeric',
    month: 'short',
  });
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
    member.nextTrip ? getAccommodationPlanSummary(member.nextTrip) : undefined,
  ].some((field) => field?.toLowerCase().includes(value));
}

function formatJoinLinkDate(value: string) {
  return formatDateOnly(value.slice(0, 10), {
    day: 'numeric',
    month: 'short',
  });
}

function joinLinkModeLabel(mode: MemberJoinLinkMode) {
  switch (mode) {
    case 'reusable':
      return 'Reusable';
    case 'single_use':
      return 'Single-use';
    case 'usage_limit':
      return 'Usage limit';
  }
}

function joinLinkStateColor(state: MemberJoinLinkState) {
  switch (state) {
    case 'active':
      return 'green';
    case 'expired':
      return 'gray';
    case 'full':
      return 'yellow';
    case 'revoked':
      return 'red';
  }
}

function joinLinkStateLabel(state: MemberJoinLinkState) {
  switch (state) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'full':
      return 'Full';
    case 'revoked':
      return 'Revoked';
  }
}

function usageLabel(link: MemberJoinLinkSummary) {
  if (link.maxUses === undefined) {
    return `${link.acceptedCount} joined`;
  }

  return `${link.acceptedCount} of ${link.maxUses} joined`;
}

function JoinLinkManagementPanel({
  joinLinks,
}: {
  joinLinks: MemberJoinLinkSummary[];
}) {
  const fetcher = useFetcher<MemberJoinLinkActionResult>();
  const [mode, setMode] = useState<MemberJoinLinkMode>('reusable');
  const [maxUses, setMaxUses] = useState<number | string>(5);
  const [copied, setCopied] = useState(false);
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok ? fetcher.data : null;
  const recentLinks = joinLinks.slice(0, 8);

  return (
    <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={2}>
            <Text fw={700}>Join links</Text>
            <Text size="sm" c="dimmed">
              Create a 24-hour link for WhatsApp, then revoke it when you no
              longer need it.
            </Text>
          </Stack>
          <ThemeIcon variant="light" color="brand" radius="sm" size={36}>
            <IconLink size={18} />
          </ThemeIcon>
        </Group>

        <fetcher.Form method="post">
          <Stack gap="sm">
            <input type="hidden" name="intent" value="createJoinLink" />
            <Group align="flex-start" gap="sm" wrap="wrap">
              <Select
                name="mode"
                label="Link mode"
                value={mode}
                onChange={(value) =>
                  setMode((value ?? 'reusable') as MemberJoinLinkMode)
                }
                data={[
                  { value: 'reusable', label: 'Reusable' },
                  { value: 'single_use', label: 'Single-use' },
                  { value: 'usage_limit', label: 'Usage limit' },
                ]}
                allowDeselect={false}
                error={fieldErrors?.mode?.[0]}
                style={{ flex: 1, minWidth: 180 }}
              />
              {mode === 'usage_limit' ? (
                <NumberInput
                  name="maxUses"
                  label="Usage limit"
                  value={maxUses}
                  onChange={setMaxUses}
                  min={2}
                  max={100}
                  step={1}
                  error={fieldErrors?.maxUses?.[0]}
                  style={{ width: 160 }}
                />
              ) : null}
              <Button type="submit" loading={isSubmitting} mt={24}>
                Create link
              </Button>
            </Group>
            <Text size="xs" c="dimmed">
              Expires after 24 hours.
            </Text>
          </Stack>
        </fetcher.Form>

        {success ? (
          <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
            <Stack gap="xs">
              <Text size="sm">{success.message}</Text>
              {success.joinUrl ? (
                <Group align="flex-end" gap="sm">
                  <TextInput
                    label="New join link"
                    value={success.joinUrl}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    style={{ flex: 1, minWidth: 240 }}
                  />
                  <Button
                    type="button"
                    variant="default"
                    leftSection={<IconCopy size={16} />}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(success.joinUrl!);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Group>
              ) : null}
            </Stack>
          </Alert>
        ) : formError ? (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        ) : null}

        {recentLinks.length > 0 ? (
          <Stack gap="xs">
            <Text size="sm" fw={700} c="dimmed">
              Recent join links
            </Text>
            <Stack gap={0}>
              {recentLinks.map((link, index) => (
                <Stack key={link.tokenHash} gap="xs">
                  <Group justify="space-between" align="center" gap="md">
                    <Stack gap={2}>
                      <Group gap="xs" wrap="wrap">
                        <Badge
                          color={joinLinkStateColor(link.state)}
                          variant="light"
                        >
                          {joinLinkStateLabel(link.state)}
                        </Badge>
                        <Text size="sm" fw={700}>
                          {joinLinkModeLabel(link.mode)}
                        </Text>
                        <Text size="sm" c="dimmed">
                          ends {link.tokenHint}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {usageLabel(link)} • Expires{' '}
                        {formatJoinLinkDate(link.expiresAt)} • Created by{' '}
                        {link.createdByName}
                      </Text>
                    </Stack>
                    {link.state === 'active' ? (
                      <fetcher.Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="revokeJoinLink"
                        />
                        <input
                          type="hidden"
                          name="tokenHash"
                          value={link.tokenHash}
                        />
                        <Button
                          type="submit"
                          variant="subtle"
                          color="red"
                          size="xs"
                          loading={isSubmitting}
                        >
                          Revoke
                        </Button>
                      </fetcher.Form>
                    ) : null}
                  </Group>
                  {index < recentLinks.length - 1 ? <Divider /> : null}
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
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
              <Badge size="sm" variant="light" color="brand">
                {member.role}
              </Badge>
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
                {member.sharedStayCount === 1
                  ? 'accommodation'
                  : 'accommodations'}
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

export function AdminMembersPage({
  members,
  joinLinks,
}: AdminMembersPageProps) {
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
              { label: 'Accommodations', value: totalSharedStays },
            ]}
          />
        }
      />

      <JoinLinkManagementPanel joinLinks={joinLinks} />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="md">
          <TextInput
            label="Search members"
            placeholder="Search by name, email, circuit, or accommodation"
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
                Try a different name, email, trip, or accommodation.
              </Text>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
