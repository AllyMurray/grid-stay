import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
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
  IconMessageCircle,
  IconMoon,
  IconRoad,
  IconSparkles,
  IconSun,
  IconUserCircle,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { Link, Outlet, useLocation, useRevalidator } from 'react-router';
import { isAdminUser } from '~/lib/auth/authorization';
import type { User } from '~/lib/auth/schemas';

interface DashboardNavItem {
  label: string;
  to: string;
  icon: ComponentType<{ size?: number | string }>;
  active: boolean;
  count?: number;
}

export interface DashboardShellProps {
  user: User;
  unreadNotificationCount: number;
}

interface DashboardNavContentProps {
  user: User;
  navItems: DashboardNavItem[];
  adminNavItems: DashboardNavItem[];
  isAdmin: boolean;
  onNavigate: () => void;
}

function DashboardNavContent({
  user,
  navItems,
  adminNavItems,
  isAdmin,
  onNavigate,
}: DashboardNavContentProps) {
  return (
    <>
      <AppShell.Section>
        <Stack className="dashboard-sidebar-profile" gap="md">
          <Group align="flex-start" wrap="nowrap">
            <Avatar src={user.picture} alt={user.name} radius="sm" size={40} />
            <Stack gap={0}>
              <Text fw={700}>{user.name}</Text>
              <Text size="sm" c="dimmed" lineClamp={1}>
                {user.email}
              </Text>
            </Stack>
          </Group>
          <Button component={Link} to="/auth/logout" variant="subtle" fullWidth>
            Log out
          </Button>
        </Stack>
      </AppShell.Section>

      <AppShell.Section grow mt="lg">
        <Stack gap="md">
          <Stack gap={4}>
            {navItems.map((item) => {
              const itemCount = item.count ?? 0;
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  component={Link}
                  to={item.to}
                  label={item.label}
                  leftSection={<Icon size={18} />}
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
                  onClick={onNavigate}
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
                {adminNavItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      component={Link}
                      to={item.to}
                      label={item.label}
                      leftSection={<Icon size={18} />}
                      active={item.active}
                      variant="filled"
                      color="brand"
                      onClick={onNavigate}
                    />
                  );
                })}
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </AppShell.Section>
    </>
  );
}

export function DashboardShell({
  user,
  unreadNotificationCount,
}: DashboardShellProps) {
  const location = useLocation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  });
  const [opened, { toggle, close }] = useDisclosure(false);
  const revalidator = useRevalidator();
  const isAdmin = isAdminUser(user);
  const mobileMenuId = 'dashboard-mobile-menu';

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
      label: 'Members',
      to: '/dashboard/members',
      icon: IconUsersGroup,
      active: location.pathname.startsWith('/dashboard/members'),
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
      label: 'Feedback',
      to: '/dashboard/feedback',
      icon: IconMessageCircle,
      active: location.pathname.startsWith('/dashboard/feedback'),
    },
    {
      label: "What's New",
      to: '/dashboard/whats-new',
      icon: IconSparkles,
      active: location.pathname.startsWith('/dashboard/whats-new'),
    },
    {
      label: 'Account',
      to: '/dashboard/account',
      icon: IconUserCircle,
      active: location.pathname.startsWith('/dashboard/account'),
    },
  ];
  const adminNavItems = [
    {
      label: 'Admin',
      to: '/dashboard/admin',
      icon: IconLock,
      active:
        location.pathname.startsWith('/dashboard/admin') ||
        location.pathname.startsWith('/dashboard/manual-days'),
    },
  ];

  return (
    <AppShell
      header={{ height: { base: 64, sm: 68 } }}
      navbar={{
        width: 248,
        breakpoint: 'sm',
        collapsed: { mobile: true },
      }}
      padding={{ base: 'xs', sm: 'md' }}
    >
      <AppShell.Header>
        <Group h="100%" px={{ base: 'sm', sm: 'lg' }} justify="space-between">
          <Group gap="sm">
            <Burger
              opened={opened}
              onClick={toggle}
              aria-controls={mobileMenuId}
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
                    : `Open notifications, ${unreadNotificationCount} pending`
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

      <Drawer
        id={mobileMenuId}
        opened={opened}
        onClose={close}
        title="Navigation"
        position="left"
        size="min(20rem, 88vw)"
        padding="md"
        hiddenFrom="sm"
        closeButtonProps={{ 'aria-label': 'Close menu' }}
      >
        <Stack gap="lg">
          <DashboardNavContent
            user={user}
            navItems={navItems}
            adminNavItems={adminNavItems}
            isAdmin={isAdmin}
            onNavigate={close}
          />
        </Stack>
      </Drawer>

      <AppShell.Navbar p="md" visibleFrom="sm">
        <DashboardNavContent
          user={user}
          navItems={navItems}
          adminNavItems={adminNavItems}
          isAdmin={isAdmin}
          onNavigate={close}
        />
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
