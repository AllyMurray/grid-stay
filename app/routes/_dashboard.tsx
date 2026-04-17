import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Button,
  Container,
  Group,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCalendarMonth,
  IconHome2,
  IconHotelService,
  IconMoon,
  IconRoad,
  IconSun,
  IconUsersGroup,
} from '@tabler/icons-react';
import { Link, Outlet, useLoaderData, useLocation } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import type { User } from '~/lib/auth/schemas';
import type { Route } from './+types/_dashboard';

interface LoaderData {
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  return Response.json({ user }, { headers });
}

export default function DashboardLayoutRoute() {
  const { user } = useLoaderData<LoaderData>();
  const location = useLocation();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [opened, { toggle, close }] = useDisclosure(false);

  const navItems = [
    {
      label: 'Overview',
      to: '/dashboard',
      icon: IconHome2,
      active: location.pathname === '/dashboard',
    },
    {
      label: 'Available Days',
      to: '/dashboard/days',
      icon: IconRoad,
      active: location.pathname.startsWith('/dashboard/days'),
    },
    {
      label: 'Schedule',
      to: '/dashboard/schedule',
      icon: IconCalendarMonth,
      active: location.pathname.startsWith('/dashboard/schedule'),
    },
    {
      label: 'My Bookings',
      to: '/dashboard/bookings',
      icon: IconHotelService,
      active: location.pathname.startsWith('/dashboard/bookings'),
    },
    {
      label: 'Members',
      to: '/dashboard/members',
      icon: IconUsersGroup,
      active: location.pathname.startsWith('/dashboard/members'),
    },
  ];

  return (
    <AppShell
      header={{ height: { base: 64, sm: 68 } }}
      navbar={{
        width: 248,
        breakpoint: 'sm',
        collapsed: { mobile: !opened, desktop: false },
      }}
      padding={{ base: 'xs', sm: 'md' }}
    >
      <AppShell.Header>
        <Group h="100%" px={{ base: 'sm', sm: 'lg' }} justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <ThemeIcon size={34} radius="sm" variant="light" color="brand">
              <IconRoad size={20} />
            </ThemeIcon>
            <Stack gap={0}>
              <Text
                fw={800}
                ff="Oswald, sans-serif"
                size="xl"
                className="dashboard-brand-title"
              >
                Grid Stay
              </Text>
              <Text size="xs" c="dimmed" visibleFrom="sm">
                Weekend planning for the paddock
              </Text>
            </Stack>
          </Group>

          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              size="lg"
              radius="sm"
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'dark' ? (
                <IconSun size={18} />
              ) : (
                <IconMoon size={18} />
              )}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={{ base: 'sm', sm: 'md' }}>
        <AppShell.Section>
          <Stack className="dashboard-sidebar-profile" gap="md">
            <Group align="flex-start" wrap="nowrap">
              <Avatar
                src={user.picture}
                alt={user.name}
                radius="sm"
                size={40}
              />
              <Stack gap={0}>
                <Text fw={700}>{user.name}</Text>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {user.email}
                </Text>
              </Stack>
            </Group>
            <Button
              component={Link}
              to="/auth/logout"
              variant="subtle"
              fullWidth
            >
              Log out
            </Button>
          </Stack>
        </AppShell.Section>

        <AppShell.Section grow mt="lg">
          <Stack gap={4}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                component={Link}
                to={item.to}
                label={item.label}
                leftSection={<item.icon size={18} />}
                active={item.active}
                variant="filled"
                color="brand"
                onClick={close}
              />
            ))}
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="app-backdrop" />
        <Container size="xl" py={{ base: 'md', sm: 'lg' }} px={0}>
          <Stack gap="xl">
            <Outlet context={{ user }} />
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
