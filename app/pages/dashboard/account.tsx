import { Badge, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBrandGoogle, IconLock, IconUserCircle } from '@tabler/icons-react';
import { PageHeader } from '~/components/layout/page-header';
import type { User } from '~/lib/auth/schemas';

interface AccountPageProps {
  hasPassword: boolean;
  passwordAuthAvailable: boolean;
  user: User;
}

export function AccountPage({
  hasPassword,
  passwordAuthAvailable,
  user,
}: AccountPageProps) {
  const passwordEnabled = passwordAuthAvailable && hasPassword;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Manage sign-in methods for your account."
      />

      <Paper className="shell-card" p="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <ThemeIcon size={44} radius="sm" variant="light" color="brand">
                <IconUserCircle size={22} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={800}>{user.name}</Text>
                <Text c="dimmed" size="sm">
                  {user.email}
                </Text>
              </Stack>
            </Group>
            <Badge color={passwordEnabled ? 'green' : 'gray'} variant="light">
              {passwordEnabled ? 'Password enabled' : 'Google sign-in'}
            </Badge>
          </Group>

          <Stack gap="sm">
            <Group gap="sm" justify="space-between">
              <Group gap="sm">
                <ThemeIcon radius="sm" variant="light" color="blue">
                  <IconBrandGoogle size={18} />
                </ThemeIcon>
                <Text fw={700}>Google sign-in</Text>
              </Group>
              <Badge color="green" variant="light">
                Available
              </Badge>
            </Group>
            <Group gap="sm" justify="space-between">
              <Group gap="sm">
                <ThemeIcon radius="sm" variant="light" color="brand">
                  <IconLock size={18} />
                </ThemeIcon>
                <Text fw={700}>Password sign-in</Text>
              </Group>
              <Badge color={passwordEnabled ? 'green' : 'gray'} variant="light">
                {passwordEnabled ? 'Available' : 'Email reset required'}
              </Badge>
            </Group>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
