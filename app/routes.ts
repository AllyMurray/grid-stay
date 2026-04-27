import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('auth/login', 'routes/auth/login.tsx'),
  route('auth/logout', 'routes/auth/logout.tsx'),
  route('api/auth/*', 'routes/api.auth.$.tsx'),
  route('api/dashboard/days-feed', 'routes/api.dashboard.days-feed.tsx'),
  route('calendar/:token', 'routes/calendar.$token.tsx'),
  route(
    'api/days/:dayId/attendees',
    'routes/dashboard/days.$dayId.attendees.tsx',
  ),
  layout('routes/_dashboard.tsx', [
    route('dashboard', 'routes/dashboard/index.tsx'),
    route('dashboard/days', 'routes/dashboard/days.tsx'),
    route(
      'dashboard/series/:seriesKey',
      'routes/dashboard/series.$seriesKey.tsx',
    ),
    route('dashboard/manual-days', 'routes/dashboard/manual-days.tsx'),
    route('dashboard/admin/feed', 'routes/dashboard/admin.feed.tsx'),
    route(
      'dashboard/admin/data-quality',
      'routes/dashboard/admin.data-quality.tsx',
    ),
    route(
      'dashboard/admin/operations',
      'routes/dashboard/admin.operations.tsx',
    ),
    route('dashboard/admin/members', 'routes/dashboard/admin.members.tsx'),
    route(
      'dashboard/admin/members/:memberId',
      'routes/dashboard/admin.members.$memberId.tsx',
    ),
    route('dashboard/notifications', 'routes/dashboard/notifications.tsx'),
    route('dashboard/schedule', 'routes/dashboard/schedule.tsx'),
    route('dashboard/bookings', 'routes/dashboard/bookings.tsx'),
    route('dashboard/members', 'routes/dashboard/members.tsx'),
  ]),
] satisfies RouteConfig;
