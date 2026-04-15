import {
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBrandGoogle,
  IconCalendarEvent,
  IconHotelService,
  IconRoad,
  IconUsersGroup,
} from '@tabler/icons-react';
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
        <Stack className="auth-login-stage" gap="xl" justify="space-between">
          <Group align="center" gap="sm" wrap="nowrap">
            <ThemeIcon size={44} radius="sm" variant="light" color="brand">
              <IconRoad size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={800} ff="Oswald, sans-serif" size="xl" c="white">
                Grid Stay
              </Text>
              <Text size="sm" c="gray.1">
                Motorsport weekends without the group-text mess
              </Text>
            </Stack>
          </Group>

          <Grid gutter={{ base: 'xl', md: 48 }} align="end">
            <Grid.Col span={{ base: 12, md: 7, lg: 8 }}>
              <Stack gap="md" maw={680}>
                <Badge color="brand" variant="light" w="fit-content">
                  Secure team access
                </Badge>
                <Title order={1} c="white" fz={{ base: 40, sm: 54, lg: 64 }}>
                  Get back to the weekend plan.
                </Title>
                <Text size="lg" c="gray.1" maw={560}>
                  Sign in once, pick up the live schedule, and keep the stay
                  details moving with the rest of the crew.
                </Text>

                <Stack gap="md" pt="sm" maw={520}>
                  {[
                    {
                      icon: IconCalendarEvent,
                      title: 'Live calendar',
                      text: 'Race, test, and track days stay on one running schedule.',
                    },
                    {
                      icon: IconUsersGroup,
                      title: 'Shared attendance',
                      text: 'Booked, maybe, and cancelled statuses stay easy to read.',
                    },
                    {
                      icon: IconHotelService,
                      title: 'Private references',
                      text: 'Your booking codes and notes stay attached to the right trip.',
                    },
                  ].map((item) => (
                    <Group
                      key={item.title}
                      align="flex-start"
                      gap="sm"
                      wrap="nowrap"
                    >
                      <ThemeIcon
                        size={36}
                        radius="sm"
                        variant="light"
                        color="brand"
                      >
                        <item.icon size={18} />
                      </ThemeIcon>
                      <Stack gap={2}>
                        <Text fw={700} c="white">
                          {item.title}
                        </Text>
                        <Text size="sm" c="gray.2">
                          {item.text}
                        </Text>
                      </Stack>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5, lg: 4 }}>
              <Paper className="auth-login-panel" p={{ base: 'lg', sm: 'xl' }}>
                <Stack gap="lg">
                  <Stack gap={6}>
                    <Text size="sm" fw={700} c="brand.3">
                      Google sign-in
                    </Text>
                    <Title order={2} c="white">
                      Open the dashboard
                    </Title>
                    <Text size="sm" c="gray.3">
                      We are opening the Google redirect now. If it stalls, use
                      the button below to continue.
                    </Text>
                  </Stack>

                  <Group
                    justify="space-between"
                    align="center"
                    className="auth-login-status"
                    gap="sm"
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Loader color="brand" size="sm" />
                      <Text size="sm" c="gray.2">
                        Redirecting to Google
                      </Text>
                    </Group>
                    <Text size="sm" c="gray.4">
                      Secure OAuth
                    </Text>
                  </Group>

                  <Button
                    size="md"
                    color="brand"
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
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
