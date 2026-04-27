import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Button,
  Container,
  Divider,
  Group,
  Indicator,
  NavLink,
  Stack,
  Text,
  ThemeIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBell,
  IconCalendarMonth,
  IconHome2,
  IconHotelService,
  IconLock,
  IconMoon,
  IconRoad,
  IconSun,
  IconUsersGroup,
} from '@tabler/icons-react';
import { useEffect } from 'react';
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useRevalidator,
} from 'react-router';
import { isAdminUser } from '~/lib/auth/authorization';
import { requireUser } from '~/lib/auth/helpers.server';
import type { User } from '~/lib/auth/schemas';
import { countUnreadDayNotifications } from '~/lib/db/services/day-notification.server';
import type { Route } from './+types/_dashboard';

interface LoaderData {
  user: User;
  unreadNotificationCount: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const unreadNotificationCount = await countUnreadDayNotifications(user.id);

  return Response.json({ user, unreadNotificationCount }, { headers });
}

export default function DashboardLayoutRoute() {
  const { user, unreadNotificationCount } = useLoaderData<LoaderData>();
  const location = useLocation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  });
  const [opened, { toggle, close }] = useDisclosure(false);
  const revalidator = useRevalidator();
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (!event.persisted) {
        return;
      }

      close();
      revalidator.revalidate();
    }

    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [close, revalidator]);

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
      label: 'Notifications',
      to: '/dashboard/notifications',
      icon: IconBell,
      active: location.pathname.startsWith('/dashboard/notifications'),
      count: unreadNotificationCount,
    },
    {
      label: 'Members',
      to: '/dashboard/members',
      icon: IconUsersGroup,
      active: location.pathname.startsWith('/dashboard/members'),
    },
  ];
  const adminNavItems = [
    {
      label: 'Manual Days',
      to: '/dashboard/manual-days',
      icon: IconLock,
      active: location.pathname.startsWith('/dashboard/manual-days'),
    },
    {
      label: 'Member Management',
      to: '/dashboard/admin/members',
      icon: IconUsersGroup,
      active: location.pathname.startsWith('/dashboard/admin/members'),
    },
  ];

  return (
    <AppShell
      header={{ height: { base: 64, sm: 68 } }}
      navbar={{
        width: 248,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={{ base: 'xs', sm: 'md' }}
    >
      <AppShell.Header>
        <Group h="100%" px={{ base: 'sm', sm: 'lg' }} justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              aria-expanded={opened}
              aria-label={opened ? 'Close menu' : 'Open menu'}
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
            <Indicator
              disabled={unreadNotificationCount === 0}
              label={unreadNotificationCount}
              size={18}
              color="brand"
            >
              <ActionIcon
                component={Link}
                to="/dashboard/notifications"
                variant="default"
                size="lg"
                radius="sm"
                aria-label={
                  unreadNotificationCount === 0
                    ? 'Open notifications'
                    : `Open notifications, ${unreadNotificationCount} unread`
                }
              >
                <IconBell size={18} />
              </ActionIcon>
            </Indicator>
            <ActionIcon
              variant="default"
              onClick={() => toggleColorScheme()}
              size="lg"
              radius="sm"
              aria-label={
                computedColorScheme === 'dark'
                  ? 'Switch to light theme'
                  : 'Switch to dark theme'
              }
            >
              {computedColorScheme === 'dark' ? (
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
          <Stack gap="md">
            <Stack gap={4}>
              {navItems.map((item) => {
                const itemCount = 'count' in item ? (item.count ?? 0) : 0;

                return (
                  <NavLink
                    key={item.to}
                    component={Link}
                    to={item.to}
                    label={item.label}
                    leftSection={<item.icon size={18} />}
                    rightSection={
                      itemCount > 0 ? (
                        <Text size="xs" fw={800} c="brand.7">
                          {itemCount}
                        </Text>
                      ) : null
                    }
                    active={item.active}
                    variant="filled"
                    color="brand"
                    onClick={close}
                  />
                );
              })}
            </Stack>

            {isAdmin ? (
              <Stack gap={6}>
                <Divider />
                <Text size="xs" fw={800} c="dimmed" tt="uppercase">
                  Admin
                </Text>
                <Stack gap={4}>
                  {adminNavItems.map((item) => (
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
              </Stack>
            ) : null}
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
