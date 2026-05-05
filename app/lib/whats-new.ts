import {
  IconBuildingSkyscraper,
  IconCalendarMonth,
  IconCarGarage,
  IconCreditCard,
  IconLock,
  IconMessageCircle,
  IconRoute,
  IconSparkles,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export interface WhatsNewEntry {
  id: string;
  title: string;
  publishedAt: string;
  dateLabel: string;
  category: string;
  description: string;
  highlights: string[];
  href?: string;
  actionLabel?: string;
  icon: ComponentType<{ size?: number | string }>;
}

export const whatsNewEntries: WhatsNewEntry[] = [
  {
    id: 'group-calendar-initials',
    title: 'Group Calendar shows attendee initials',
    publishedAt: '2026-05-05T22:45:00.000Z',
    dateLabel: '5 May 2026',
    category: 'Members',
    description:
      'Group Calendar month cells now show compact initials for booked and maybe members, so shared plans are easier to scan without opening every date.',
    highlights: [
      'Booked and maybe summaries show member initials directly in each active calendar date.',
      'Full names, arrival times, and accommodation details remain in the date drawer.',
      'People and status filters update the visible initials as well as the counts.',
    ],
    href: '/dashboard/group-calendar',
    actionLabel: 'Open group calendar',
    icon: IconUsersGroup,
  },
  {
    id: 'track-stay-accommodation',
    title: 'Track stays can be shared',
    publishedAt: '2026-05-05T16:12:00.000Z',
    dateLabel: '5 May 2026',
    category: 'Bookings',
    description:
      'Accommodation plans now include staying at the track for camping, campervans, tentboxes, and paddock overnight stays.',
    highlights: [
      'Choose Staying at the track from the accommodation plan in My Bookings.',
      'The plan is visible to other members coordinating the same day.',
      'Track stays do not require a hotel lookup, hotel name, or hotel reference.',
    ],
    href: '/dashboard/bookings?view=manage',
    actionLabel: 'Update accommodation',
    icon: IconBuildingSkyscraper,
  },
  {
    id: 'bookings-schedule-views',
    title: 'Schedule views moved into My Bookings',
    publishedAt: '2026-05-05T14:00:00.000Z',
    dateLabel: '5 May 2026',
    category: 'Bookings',
    description:
      'My Bookings now brings upcoming trips, calendar sync, the trip calendar, and private booking edits together on one page.',
    highlights: [
      'Upcoming trips is the default view so the next dates are immediately visible.',
      'Calendar view stays available from the same page when you need a month view.',
      'Manage keeps the full editor for accommodation, arrival, garage, and private details.',
    ],
    href: '/dashboard/bookings',
    actionLabel: 'Open My Bookings',
    icon: IconCalendarMonth,
  },
  {
    id: 'group-calendar',
    title: 'Group calendar for shared plans',
    publishedAt: '2026-05-05T09:00:00.000Z',
    dateLabel: '5 May 2026',
    category: 'Members',
    description:
      'The new Group Calendar shows who is booked or maybe across a month, with track context directly in each active date.',
    highlights: [
      'Month cells show circuit and layout names alongside booked and maybe counts.',
      'Leave people blank to show everyone, or select the members you want to focus on.',
      'Open a date to review each event, the matching roster, arrival times, and accommodation plans.',
    ],
    href: '/dashboard/group-calendar',
    actionLabel: 'Open group calendar',
    icon: IconUsersGroup,
  },
  {
    id: 'accommodation-plan-status',
    title: 'Mark when no hotel is needed',
    publishedAt: '2026-05-04T22:00:00.000Z',
    dateLabel: '4 May 2026',
    category: 'Bookings',
    description:
      'Bookings now separate the accommodation plan from the hotel details, so one-day trips can be marked clearly without adding a stay.',
    highlights: [
      'Set a trip to not set, no hotel needed, staying at the track, need a hotel, or hotel booked.',
      'Hotel search, references, and feedback only appear when a hotel is actually booked.',
      'Available Days, My Bookings, Members, and Overview now show the accommodation plan consistently.',
    ],
    href: '/dashboard/bookings',
    actionLabel: 'Open bookings',
    icon: IconBuildingSkyscraper,
  },
  {
    id: 'hotel-catalogue-feedback',
    title: 'Hotel lookup, feedback, and summaries',
    publishedAt: '2026-05-04T21:00:00.000Z',
    dateLabel: '4 May 2026',
    category: 'Bookings',
    description:
      'My Bookings now has hotel search, saved hotel details, group feedback, and background summaries for parking and arrival logistics.',
    highlights: [
      'Find hotels with address lookup, or add a stay manually when lookup misses.',
      'Saved hotels become reusable Grid Stay catalogue entries linked to bookings.',
      'Members can record trailer parking, secure parking, late check-in, ratings, and notes.',
      'Hotel review summaries refresh in the background after new feedback is saved.',
    ],
    href: '/dashboard/bookings',
    actionLabel: 'Open bookings',
    icon: IconBuildingSkyscraper,
  },
  {
    id: 'planner-same-day-options',
    title: 'Planner now shows same-day options',
    publishedAt: '2026-05-04T14:00:00.000Z',
    dateLabel: '4 May 2026',
    category: 'Planning',
    description:
      'Journey planner recommendations now show the other events available on the same date.',
    highlights: [
      'Recommended stops are labelled directly in the planner route.',
      'Other same-date events appear under the recommended stop for comparison.',
      'Recommendations still prioritise the most stops, then the lowest road miles.',
    ],
    href: '/dashboard/days?view=planner',
    actionLabel: 'Open planner',
    icon: IconRoute,
  },
  {
    id: 'available-days-upcoming-default',
    title: 'Available Days now starts with upcoming dates',
    publishedAt: '2026-05-04T13:00:00.000Z',
    dateLabel: '4 May 2026',
    category: 'Available Days',
    description:
      'The Available Days feed now focuses on future dates by default, with an option to bring older dates back when needed.',
    highlights: [
      'Past dates are hidden from the feed unless you choose to show them.',
      'Use the Show past dates filter when you need to review older events.',
      'Calendar, planner, pagination, and saved views preserve the past-date setting.',
    ],
    href: '/dashboard/days',
    actionLabel: 'Open upcoming dates',
    icon: IconCalendarMonth,
  },
  {
    id: 'available-days-calendar-planner',
    title: 'Calendar and journey planner for Available Days',
    publishedAt: '2026-05-04T10:00:00.000Z',
    dateLabel: '4 May 2026',
    category: 'Planning',
    description:
      'Available Days now has calendar and journey planner views so you can scan the season and plan runs of nearby events.',
    highlights: [
      'Use the Calendar tab to review filtered Available Days by month.',
      'Build a journey plan between matching days with estimated road miles and drive time.',
      'The planner uses the same month, race series, circuit, provider, and day type filters as the main feed.',
    ],
    href: '/dashboard/days?view=planner',
    actionLabel: 'Open planner',
    icon: IconRoute,
  },
  {
    id: 'member-event-requests',
    title: 'Add missing events',
    publishedAt: '2026-05-03T19:00:00.000Z',
    dateLabel: '3 May 2026',
    category: 'Events',
    description:
      'Members can now add missing track days, club days, and group road drives to the shared calendar.',
    highlights: [
      'Add an event from Available Days with the date, location, organiser, and link.',
      'Saved events appear in the shared calendar immediately for everyone.',
      'Road drives appear as their own day type across bookings, schedules, and calendar feeds.',
    ],
    href: '/dashboard/days',
    actionLabel: 'Add an event',
    icon: IconCalendarMonth,
  },
  {
    id: 'cost-splitting',
    title: 'Split shared event costs',
    publishedAt: '2026-05-03T18:00:00.000Z',
    dateLabel: '3 May 2026',
    category: 'Cost splitting',
    description:
      'Available Days now includes participant-only cost groups, expenses, and net settlement tracking for each event.',
    highlights: [
      'Create cost groups for garages, hotels, meals, fuel, or other shared costs.',
      'Add expenses and see who owes who across the groups visible to you.',
      'Save a payment link in Account so other members can pay you more easily.',
    ],
    href: '/dashboard/days',
    actionLabel: 'Open cost splitting',
    icon: IconCreditCard,
  },
  {
    id: 'garage-sharing',
    title: 'Garage sharing is now built in',
    publishedAt: '2026-05-03T12:00:00.000Z',
    dateLabel: '3 May 2026',
    category: 'Garage sharing',
    description:
      'Drivers can share spare garage space for track days and manage requests without leaving the event plan.',
    highlights: [
      'Mark a booking as having a garage and set how many cars it can hold.',
      'See open garage spaces from Available Days before asking to share.',
      'Approve, decline, or cancel garage share requests from My Bookings and Notifications.',
    ],
    href: '/dashboard/days',
    actionLabel: 'Open available days',
    icon: IconCarGarage,
  },
  {
    id: 'feedback-updates',
    title: 'Feedback updates are easier to track',
    publishedAt: '2026-05-03T11:00:00.000Z',
    dateLabel: '3 May 2026',
    category: 'Feedback',
    description:
      'When you send feedback, you can now receive updates and track the request from your Feedback page.',
    highlights: [
      'See your submitted feedback requests in one place.',
      'Track the latest status and replies alongside the original request.',
      'Email updates link back to the matching feedback request.',
    ],
    href: '/dashboard/feedback',
    actionLabel: 'Open feedback',
    icon: IconMessageCircle,
  },
  {
    id: 'upcoming-schedule',
    title: 'My Bookings starts with what is ahead',
    publishedAt: '2026-05-03T10:00:00.000Z',
    dateLabel: '3 May 2026',
    category: 'Bookings',
    description:
      'The upcoming view focuses on booked and maybe trips, while Manage keeps the full trip history.',
    highlights: [
      'Past and cancelled trips stay available in Manage.',
      'Trip totals now match the trips shown in the current view.',
      'The empty state links straight back to the full booking list.',
    ],
    href: '/dashboard/bookings',
    actionLabel: 'Open My Bookings',
    icon: IconCalendarMonth,
  },
  {
    id: 'member-days',
    title: 'Book alongside other members',
    publishedAt: '2026-05-02T10:00:00.000Z',
    dateLabel: '2 May 2026',
    category: 'Members',
    description:
      'Member profiles now show upcoming shared days so it is easier to book the same dates as another driver.',
    highlights: [
      'Open a member record to see their shared days.',
      'Add a matching day as booked or maybe from the member view.',
      'Private booking references and notes remain private.',
    ],
    href: '/dashboard/members',
    actionLabel: 'Open members',
    icon: IconUsersGroup,
  },
  {
    id: 'password-sign-in',
    title: 'Password sign-in is available',
    publishedAt: '2026-05-01T10:00:00.000Z',
    dateLabel: '1 May 2026',
    category: 'Account',
    description:
      'Users can now sign in with either Google or email and password, including existing Google accounts.',
    highlights: [
      'Existing users can add password access through the reset-password flow.',
      'Google sign-in continues to work after adding a password.',
      'Password emails are sent from the Grid Stay domain.',
    ],
    href: '/dashboard/account',
    actionLabel: 'Open account',
    icon: IconLock,
  },
  {
    id: 'dashboard-polish',
    title: 'Cleaner mobile dashboard headers',
    publishedAt: '2026-04-30T10:00:00.000Z',
    dateLabel: '30 April 2026',
    category: 'Interface',
    description:
      'Dashboard headers now use compact summaries so mobile screens get to the working content faster.',
    highlights: [
      'Available Days, Members, My Bookings, and Overview use tighter summaries.',
      'Large stacked stat pills were removed from key mobile pages.',
      'Navigation remains available from the dashboard menu.',
    ],
    href: '/dashboard',
    actionLabel: 'Open overview',
    icon: IconSparkles,
  },
];

export function countWhatsNewEntriesAfter(
  viewedAt: string | undefined,
  entries: WhatsNewEntry[] = whatsNewEntries,
) {
  return entries.filter((entry) => !viewedAt || entry.publishedAt > viewedAt)
    .length;
}

export function getLatestWhatsNewPublishedAt(
  entries: WhatsNewEntry[] = whatsNewEntries,
) {
  return entries.reduce<string | undefined>(
    (latest, entry) =>
      !latest || entry.publishedAt > latest ? entry.publishedAt : latest,
    undefined,
  );
}

export function resolveWhatsNewViewedAt(
  viewedAt: string,
  entries: WhatsNewEntry[] = whatsNewEntries,
) {
  const latestPublishedAt = getLatestWhatsNewPublishedAt(entries);
  return latestPublishedAt && latestPublishedAt > viewedAt
    ? latestPublishedAt
    : viewedAt;
}
