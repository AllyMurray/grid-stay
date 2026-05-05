import {
  index,
  layout,
  type RouteConfig,
  route,
} from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('auth/forgot-password', 'routes/auth/forgot-password.tsx'),
  route('auth/login', 'routes/auth/login.tsx'),
  route('auth/logout', 'routes/auth/logout.tsx'),
  route('auth/reset-password', 'routes/auth/reset-password.tsx'),
  route('api/auth/*', 'routes/api.auth.$.tsx'),
  route('api/dashboard/days-feed', 'routes/api.dashboard.days-feed.tsx'),
  route('api/hotels/search', 'routes/api.hotels.search.tsx'),
  route('calendar/:token', 'routes/calendar.$token.tsx'),
  route('join/:token', 'routes/join.$token.tsx'),
  route(
    'api/days/:dayId/attendees',
    'routes/dashboard/days.$dayId.attendees.tsx',
  ),
  route('api/days/:dayId/costs', 'routes/dashboard/days.$dayId.costs.tsx'),
  layout('routes/_dashboard.tsx', [
    route('dashboard', 'routes/dashboard/index.tsx'),
    route('dashboard/account', 'routes/dashboard/account.tsx'),
    route('dashboard/feedback', 'routes/dashboard/feedback.tsx'),
    route('dashboard/days', 'routes/dashboard/days.tsx'),
    route(
      'dashboard/series/:seriesKey',
      'routes/dashboard/series.$seriesKey.tsx',
    ),
    route('dashboard/admin', 'routes/dashboard/admin.tsx'),
    route('dashboard/manual-days', 'routes/dashboard/manual-days.tsx'),
    route('dashboard/admin/circuits', 'routes/dashboard/admin.circuits.tsx'),
    route(
      'dashboard/admin/day-merges',
      'routes/dashboard/admin.day-merges.tsx',
    ),
    route('dashboard/admin/feed', 'routes/dashboard/admin.feed.tsx'),
    route('dashboard/admin/feedback', 'routes/dashboard/admin.feedback.tsx'),
    route('dashboard/admin/export', 'routes/dashboard/admin.export.tsx'),
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
    route('dashboard/whats-new', 'routes/dashboard/whats-new.tsx'),
    route('dashboard/group-calendar', 'routes/dashboard/group-calendar.tsx'),
    route('dashboard/schedule', 'routes/dashboard/schedule.tsx'),
    route('dashboard/bookings', 'routes/dashboard/bookings.tsx'),
    route(
      'dashboard/hotels/:hotelId/feedback',
      'routes/dashboard/hotels.$hotelId.feedback.tsx',
    ),
    route('dashboard/members', 'routes/dashboard/members.tsx'),
    route(
      'dashboard/members/:memberId',
      'routes/dashboard/members.$memberId.tsx',
    ),
  ]),
] satisfies RouteConfig;
