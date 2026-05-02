import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconLock, IconUserCircle } from '@tabler/icons-react';
import { Form, useNavigation } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import {
  type AccountPasswordActionData,
  PASSWORD_MIN_LENGTH,
} from '~/lib/auth/password-auth.shared';
import type { User } from '~/lib/auth/schemas';

interface AccountPageProps {
  actionData?: AccountPasswordActionData;
  hasPassword: boolean;
  passwordAuthAvailable: boolean;
  user: User;
}

export function AccountPage({
  actionData,
  hasPassword,
  passwordAuthAvailable,
  user,
}: AccountPageProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const passwordEnabled =
    passwordAuthAvailable && (actionData?.ok ? true : hasPassword);

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

          {actionData?.ok ? (
            <Alert color="green" icon={<IconLock size={16} />}>
              {actionData.message}
            </Alert>
          ) : null}
          {actionData && !actionData.ok ? (
            <Alert color="red" icon={<IconLock size={16} />}>
              {actionData.formError}
            </Alert>
          ) : null}

          {!passwordAuthAvailable ? (
            <Text c="dimmed">Your account uses Google sign-in.</Text>
          ) : passwordEnabled ? (
            <Text c="dimmed">
              Password sign-in is available for this account.
            </Text>
          ) : (
            <Form method="post">
              <Stack gap="md" maw={420}>
                <PasswordInput
                  name="password"
                  label="Password"
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  required
                  error={actionData?.fieldErrors.password?.[0]}
                />
                <Button
                  type="submit"
                  leftSection={<IconLock size={18} />}
                  loading={isSubmitting}
                >
                  Set password
                </Button>
              </Stack>
            </Form>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
