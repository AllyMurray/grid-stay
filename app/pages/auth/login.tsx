import {
  Button,
  Container,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconBrandGoogle, IconRoad } from '@tabler/icons-react';
import { useEffect } from 'react';
import { authClient } from '~/lib/auth/auth-client';

interface LoginPageProps {
  redirectTo: string;
}

export function LoginPage({ redirectTo }: LoginPageProps) {
  useEffect(() => {
    authClient.signIn.social({
      provider: 'google',
      callbackURL: redirectTo,
    });
  }, [redirectTo]);

  return (
    <Container size="sm" py={96}>
      <Stack gap="xl">
        <Stack gap="sm" align="center">
          <ThemeIcon size={52} radius="sm" variant="light" color="brand">
            <IconRoad size={24} />
          </ThemeIcon>
          <Title order={1} ta="center">
            Sending you to Google
          </Title>
          <Text c="dimmed" ta="center" maw={520}>
            One sign-in keeps the crew list, the bookings, and the shared stay
            in step across the weekend.
          </Text>
        </Stack>

        <Paper className="shell-card" p="xl">
          <Stack gap="md" align="center">
            <Loader color="brand" />
            <Text fw={700}>Opening the sign-in flow now.</Text>
            <Text size="sm" c="dimmed" ta="center">
              If the redirect stalls, start it again here.
            </Text>
            <Button
              leftSection={<IconBrandGoogle size={16} />}
              onClick={() =>
                authClient.signIn.social({
                  provider: 'google',
                  callbackURL: redirectTo,
                })
              }
            >
              Continue with Google
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
