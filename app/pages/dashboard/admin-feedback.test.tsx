import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { FeedbackThread } from '~/lib/db/services/feedback.server';
import { theme } from '~/theme';
import { AdminFeedbackPage } from './admin-feedback';

function createFeedback(
  overrides: Partial<FeedbackThread> = {},
): FeedbackThread {
  return {
    feedbackId: 'feedback-1',
    feedbackScope: 'feedback',
    userId: 'user-1',
    userName: 'Driver One',
    userEmail: 'driver@example.com',
    type: 'feature_request',
    status: 'new',
    title: 'Saved filter presets',
    message: 'Please let me save several available-day filters.',
    context: 'Available Days',
    adminUpdates: [],
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
    ...overrides,
  };
}

function renderAdminFeedbackPage(items: FeedbackThread[] = [createFeedback()]) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/admin/feedback',
      action: async () => null,
      Component: () => (
        <MantineProvider theme={theme}>
          <AdminFeedbackPage feedback={items} />
        </MantineProvider>
      ),
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/admin/feedback']} />);
}

describe('AdminFeedbackPage', () => {
  it('renders member feedback with inline admin controls', () => {
    renderAdminFeedbackPage([
      createFeedback({
        adminUpdates: [
          {
            updateId: 'update-1',
            status: 'planned',
            message: 'We have added this to the next sprint.',
            createdAt: '2026-05-04T10:00:00.000Z',
            authorName: 'Admin One',
          },
        ],
      }),
    ]);

    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeVisible();
    expect(screen.getByText('Saved filter presets')).toBeVisible();
    expect(screen.getByText(/Driver One · driver@example.com/)).toBeVisible();
    expect(screen.getByText('Context: Available Days')).toBeVisible();
    expect(
      screen.getByText('We have added this to the next sprint.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save status' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send update' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  it('opens a delete confirmation modal', async () => {
    const user = userEvent.setup();
    renderAdminFeedbackPage();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByRole('button', { name: 'Delete feedback' }),
    ).toBeInTheDocument();
  });

  it('collapses done feedback until the admin expands it', async () => {
    const user = userEvent.setup();
    renderAdminFeedbackPage([
      createFeedback({
        feedbackId: 'feedback-active',
        title: 'Active request',
        message: 'This still needs attention.',
      }),
      createFeedback({
        feedbackId: 'feedback-done',
        status: 'closed',
        title: 'Completed request',
        message: 'This has already been handled.',
      }),
    ]);

    expect(screen.getByText('Active request')).toBeVisible();
    expect(screen.queryByText('Completed request')).not.toBeInTheDocument();
    expect(screen.getByText('Done feedback')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show done' }));

    expect(screen.getByText('Completed request')).toBeVisible();
    expect(screen.getByText('This has already been handled.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hide done' })).toBeVisible();
  });

  it('renders an empty state when no feedback has been submitted', () => {
    renderAdminFeedbackPage([]);

    expect(screen.getByText('No feedback yet')).toBeVisible();
  });
});
