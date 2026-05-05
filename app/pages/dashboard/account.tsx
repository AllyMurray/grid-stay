import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBrandGoogle,
  IconCreditCard,
  IconLock,
  IconUserCircle,
} from '@tabler/icons-react';
import { useFetcher } from 'react-router';
import { PageHeader } from '~/components/layout/page-header';
import type { User } from '~/lib/auth/schemas';
import type { MemberPaymentPreferenceActionResult } from '~/lib/cost-splitting/actions.server';

interface AccountPageProps {
  hasPassword: boolean;
  paymentPreference: {
    label: string;
    url: string;
  } | null;
  user: User;
}

export function AccountPage({
  hasPassword,
  paymentPreference,
  user,
}: AccountPageProps) {
  const passwordEnabled = hasPassword;
  const fetcher = useFetcher<MemberPaymentPreferenceActionResult>();
  const isSubmitting = fetcher.state !== 'idle';
  const fieldErrors =
    fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors : undefined;
  const formError =
    fetcher.data && !fetcher.data.ok ? fetcher.data.formError : null;
  const success = fetcher.data?.ok;

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Manage sign-in methods for your account."
      />

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
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

      <Paper className="shell-card" p={{ base: 'md', sm: 'lg' }}>
        <Stack gap="lg">
          <Group gap="md">
            <ThemeIcon size={44} radius="sm" variant="light" color="green">
              <IconCreditCard size={22} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={800}>Payment link</Text>
              <Text c="dimmed" size="sm">
                Store the link other members can use when they owe you money.
              </Text>
            </Stack>
          </Group>

          <fetcher.Form method="post">
            <Stack gap="md">
              <Group align="flex-start" gap="md">
                <TextInput
                  name="label"
                  label="Label"
                  placeholder="Monzo, Revolut, bank link..."
                  defaultValue={paymentPreference?.label ?? ''}
                  error={fieldErrors?.label?.[0]}
                  style={{ flex: 1, minWidth: 180 }}
                />
                <TextInput
                  name="url"
                  label="Payment link"
                  placeholder="https://..."
                  defaultValue={paymentPreference?.url ?? ''}
                  error={fieldErrors?.url?.[0]}
                  style={{ flex: 2, minWidth: 240 }}
                />
                <Button type="submit" loading={isSubmitting} mt={24}>
                  Save
                </Button>
              </Group>

              {success ? (
                <Alert color="green" variant="light">
                  Payment link saved.
                </Alert>
              ) : formError ? (
                <Alert color="red" variant="light">
                  {formError}
                </Alert>
              ) : (
                <Text size="sm" c="dimmed">
                  Clear both fields and save to remove your payment link.
                </Text>
              )}
            </Stack>
          </fetcher.Form>
        </Stack>
      </Paper>
    </Stack>
  );
}
