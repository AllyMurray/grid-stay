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
  route(
    'api/days/:dayId/attendees',
    'routes/dashboard/days.$dayId.attendees.tsx',
  ),
  layout('routes/_dashboard.tsx', [
    route('dashboard', 'routes/dashboard/index.tsx'),
    route('dashboard/days', 'routes/dashboard/days.tsx'),
    route('dashboard/bookings', 'routes/dashboard/bookings.tsx'),
    route('dashboard/members', 'routes/dashboard/members.tsx'),
  ]),
] satisfies RouteConfig;
