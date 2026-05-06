import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconLock, IconRoad } from '@tabler/icons-react';
import { Form, Link, useNavigation } from 'react-router';
import type { PasswordResetRequestActionData } from '~/lib/auth/password-auth.shared';

interface ForgotPasswordPageProps {
  actionData?: PasswordResetRequestActionData;
}

const LOGIN_BACKGROUND_IMAGE =
  'https://images.pexels.com/photos/1571882/pexels-photo-1571882.jpeg?cs=srgb&dl=pexels-tomverdoot-1571882.jpg&fm=jpg';

export function ForgotPasswordPage({ actionData }: ForgotPasswordPageProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== 'idle';

  return (
    <Box className="auth-login-shell" style={{ backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE})` }}>
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
                    Reset password
                  </Title>
                  <Text c="dimmed" size="sm">
                    Enter your email and we will send a reset link
                  </Text>
                </Stack>
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

              <Form method="post">
                <Stack gap="md">
                  <TextInput
                    name="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    error={actionData?.fieldErrors.email?.[0]}
                  />
                  <Button
                    type="submit"
                    leftSection={<IconLock size={18} />}
                    loading={isSubmitting}
                    fullWidth
                  >
                    Send reset link
                  </Button>
                </Stack>
              </Form>

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
