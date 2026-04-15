import { Box, Container, Loader, Stack, ThemeIcon } from '@mantine/core';
import { IconRoad } from '@tabler/icons-react';
import { useEffect } from 'react';
import { authClient } from '~/lib/auth/auth-client';

interface LoginPageProps {
  redirectTo: string;
}

const LOGIN_BACKGROUND_IMAGE =
  'https://images.pexels.com/photos/1571882/pexels-photo-1571882.jpeg?cs=srgb&dl=pexels-tomverdoot-1571882.jpg&fm=jpg';

export function LoginPage({ redirectTo }: LoginPageProps) {
  useEffect(() => {
    authClient.signIn.social({
      provider: 'google',
      callbackURL: redirectTo,
    });
  }, [redirectTo]);

  return (
    <Box
      className="auth-login-shell"
      style={{ backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE})` }}
    >
      <Container size="xl" className="auth-login-container">
        <Stack className="auth-login-stage" justify="center" align="center">
          <Stack
            align="center"
            gap="md"
            className="auth-login-handoff"
            role="status"
            aria-label="Signing in"
          >
            <ThemeIcon size={56} radius="sm" variant="light" color="brand">
              <IconRoad size={24} />
            </ThemeIcon>
            <Loader color="brand" size="md" />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
