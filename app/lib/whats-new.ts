import {
  IconCalendarMonth,
  IconLock,
  IconSparkles,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export interface WhatsNewEntry {
  id: string;
  title: string;
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
    id: 'upcoming-schedule',
    title: 'Schedule starts with what is ahead',
    dateLabel: '3 May 2026',
    category: 'Schedule',
    description:
      'The Schedule page now focuses on upcoming booked and maybe trips, while My Bookings remains the full trip history.',
    highlights: [
      'Past and cancelled trips stay available in My Bookings.',
      'Schedule totals now match the trips shown on that page.',
      'The empty state links straight back to the full booking list.',
    ],
    href: '/dashboard/schedule',
    actionLabel: 'Open schedule',
    icon: IconCalendarMonth,
  },
  {
    id: 'member-days',
    title: 'Book alongside other members',
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
    dateLabel: '30 April 2026',
    category: 'Interface',
    description:
      'Dashboard headers now use compact summaries so mobile screens get to the working content faster.',
    highlights: [
      'Available Days, Members, Schedule, My Bookings, and Overview use tighter summaries.',
      'Large stacked stat pills were removed from key mobile pages.',
      'Navigation remains available from the dashboard menu.',
    ],
    href: '/dashboard',
    actionLabel: 'Open overview',
    icon: IconSparkles,
  },
];
