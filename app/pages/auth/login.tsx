import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconBrandGoogle, IconLock, IconRoad } from '@tabler/icons-react';
import { Form, Link, useNavigation } from 'react-router';
import { authClient } from '~/lib/auth/auth-client';
import {
  PASSWORD_MIN_LENGTH,
  type PasswordAuthActionData,
} from '~/lib/auth/password-auth.shared';

interface LoginPageProps {
  actionData?: PasswordAuthActionData;
  authError?: string;
  notice?: string;
  redirectTo: string;
}

const LOGIN_BACKGROUND_IMAGE =
  'https://images.pexels.com/photos/1571882/pexels-photo-1571882.jpeg?cs=srgb&dl=pexels-tomverdoot-1571882.jpg&fm=jpg';

function getFirstFieldError(
  actionData: PasswordAuthActionData | undefined,
  intent: PasswordAuthActionData['intent'],
  field: keyof PasswordAuthActionData['fieldErrors'],
) {
  return actionData?.intent === intent
    ? actionData.fieldErrors[field]?.[0]
    : undefined;
}

export function LoginPage({
  actionData,
  authError,
  notice,
  redirectTo,
}: LoginPageProps) {
  const navigation = useNavigation();
  const pendingIntent = navigation.formData?.get('intent')?.toString();

  function signInWithGoogle() {
    authClient.signIn.social({
      provider: 'google',
      callbackURL: redirectTo,
      errorCallbackURL: `/auth/login?redirectTo=${encodeURIComponent(
        redirectTo,
      )}`,
    });
  }

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
                    Grid Stay
                  </Title>
                  <Text c="dimmed" size="sm">
                    Sign in to continue
                  </Text>
                </Stack>
              </Group>

              <Button
                leftSection={<IconBrandGoogle size={18} />}
                onClick={signInWithGoogle}
                variant="default"
                fullWidth
              >
                Continue with Google
              </Button>

              {authError ? (
                <Alert color="red" icon={<IconLock size={16} />}>
                  {authError}
                </Alert>
              ) : null}

              {notice ? (
                <Alert color="green" icon={<IconLock size={16} />}>
                  {notice}
                </Alert>
              ) : null}

              <Divider label="or" labelPosition="center" />

              <Tabs
                defaultValue={
                  actionData?.intent === 'passwordSignUp' ? 'signup' : 'signin'
                }
                keepMounted={false}
              >
                <Tabs.List grow>
                  <Tabs.Tab value="signin">Sign in</Tabs.Tab>
                  <Tabs.Tab value="signup">Create account</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="signin" pt="lg">
                  <Form method="post">
                    <Stack gap="md">
                      <input
                        type="hidden"
                        name="intent"
                        value="passwordSignIn"
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={redirectTo}
                      />
                      {actionData?.intent === 'passwordSignIn' &&
                      actionData.formError ? (
                        <Alert color="red" icon={<IconLock size={16} />}>
                          {actionData.formError}
                        </Alert>
                      ) : null}
                      <TextInput
                        name="email"
                        label="Email"
                        type="email"
                        autoComplete="email"
                        required
                        error={getFirstFieldError(
                          actionData,
                          'passwordSignIn',
                          'email',
                        )}
                      />
                      <PasswordInput
                        name="password"
                        label="Password"
                        autoComplete="current-password"
                        required
                        error={getFirstFieldError(
                          actionData,
                          'passwordSignIn',
                          'password',
                        )}
                      />
                      <Button
                        type="submit"
                        leftSection={<IconLock size={18} />}
                        loading={pendingIntent === 'passwordSignIn'}
                        fullWidth
                      >
                        Sign in
                      </Button>
                      <Button
                        component={Link}
                        to="/auth/forgot-password"
                        variant="subtle"
                        fullWidth
                      >
                        Forgot password?
                      </Button>
                    </Stack>
                  </Form>
                </Tabs.Panel>

                <Tabs.Panel value="signup" pt="lg">
                  <Form method="post">
                    <Stack gap="md">
                      <input
                        type="hidden"
                        name="intent"
                        value="passwordSignUp"
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={redirectTo}
                      />
                      {actionData?.intent === 'passwordSignUp' &&
                      actionData.formError ? (
                        <Alert color="red" icon={<IconLock size={16} />}>
                          {actionData.formError}
                        </Alert>
                      ) : null}
                      <Group grow align="flex-start">
                        <TextInput
                          name="firstName"
                          label="First name"
                          autoComplete="given-name"
                          required
                          error={getFirstFieldError(
                            actionData,
                            'passwordSignUp',
                            'firstName',
                          )}
                        />
                        <TextInput
                          name="lastName"
                          label="Last name"
                          autoComplete="family-name"
                          required
                          error={getFirstFieldError(
                            actionData,
                            'passwordSignUp',
                            'lastName',
                          )}
                        />
                      </Group>
                      <TextInput
                        name="email"
                        label="Email"
                        type="email"
                        autoComplete="email"
                        required
                        error={getFirstFieldError(
                          actionData,
                          'passwordSignUp',
                          'email',
                        )}
                      />
                      <PasswordInput
                        name="password"
                        label="Password"
                        autoComplete="new-password"
                        minLength={PASSWORD_MIN_LENGTH}
                        required
                        error={getFirstFieldError(
                          actionData,
                          'passwordSignUp',
                          'password',
                        )}
                      />
                      <Button
                        type="submit"
                        leftSection={<IconLock size={18} />}
                        loading={pendingIntent === 'passwordSignUp'}
                        fullWidth
                      >
                        Create account
                      </Button>
                    </Stack>
                  </Form>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
