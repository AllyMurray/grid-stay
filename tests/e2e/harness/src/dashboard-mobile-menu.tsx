import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '~/app.css';

import { MantineProvider } from '@mantine/core';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { DashboardShell } from '~/components/layout/dashboard-shell';
import { theme } from '~/theme';

const dashboardUser = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'admin' as const,
};

const router = createMemoryRouter(
  [
    {
      path: '/dashboard',
      element: (
        <MantineProvider theme={theme}>
          <DashboardShell user={dashboardUser} unreadNotificationCount={2} />
        </MantineProvider>
      ),
      children: [
        {
          index: true,
          element: <div>Dashboard content</div>,
        },
        {
          path: 'members',
          element: <div>Members page</div>,
        },
      ],
    },
  ],
  {
    initialEntries: ['/dashboard'],
  },
);

createRoot(document.getElementById('root') as HTMLElement).render(
  <RouterProvider router={router} />,
);
