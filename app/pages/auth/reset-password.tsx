import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconLock, IconRoad } from '@tabler/icons-react';
import { Form, Link, useNavigation } from 'react-router';
import {
  PASSWORD_MIN_LENGTH,
  type PasswordResetActionData,
} from '~/lib/auth/password-auth.shared';

interface ResetPasswordPageProps {
  actionData?: PasswordResetActionData;
  token?: string;
}

const LOGIN_BACKGROUND_IMAGE =
  'https://images.pexels.com/photos/1571882/pexels-photo-1571882.jpeg?cs=srgb&dl=pexels-tomverdoot-1571882.jpg&fm=jpg';

export function ResetPasswordPage({
  actionData,
  token,
}: ResetPasswordPageProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';
  const tokenError = actionData?.fieldErrors.token?.[0];

  return (
    <Box
      className="auth-login-shell"
      style={{ backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE})` }}
    >
      <Container size="xl" className="auth-login-container">
        <Stack className="auth-login-stage" justify="center" align="center">
          <Paper className="auth-login-panel" radius="sm" p="xl" shadow="xl">
            <Stack gap="lg">
              <Group gap="sm">
                <ThemeIcon size={44} radius="sm" variant="light" color="brand">
                  <IconRoad size={22} />
                </ThemeIcon>
                <Stack gap={0}>
                  <Title order={1} size="h2">
                    Choose a new password
                  </Title>
                  <Text c="dimmed" size="sm">
                    This will update password sign-in for your account
                  </Text>
                </Stack>
              </Group>

              {!token ? (
                <Alert color="red" icon={<IconLock size={16} />}>
                  This reset link is invalid or has expired.
                </Alert>
              ) : null}
              {actionData && !actionData.ok ? (
                <Alert color="red" icon={<IconLock size={16} />}>
                  {actionData.formError}
                </Alert>
              ) : null}
              {tokenError ? (
                <Alert color="red" icon={<IconLock size={16} />}>
                  {tokenError}
                </Alert>
              ) : null}

              {token ? (
                <Form method="post">
                  <Stack gap="md">
                    <input type="hidden" name="token" value={token} />
                    <PasswordInput
                      name="password"
                      label="New password"
                      autoComplete="new-password"
                      minLength={PASSWORD_MIN_LENGTH}
                      required
                      error={actionData?.fieldErrors.password?.[0]}
                    />
                    <Button
                      type="submit"
                      leftSection={<IconLock size={18} />}
                      loading={isSubmitting}
                      fullWidth
                    >
                      Reset password
                    </Button>
                  </Stack>
                </Form>
              ) : null}

              <Button
                component={Link}
                to="/auth/login"
                variant="subtle"
                leftSection={<IconArrowLeft size={18} />}
                fullWidth
              >
                Back to sign in
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
