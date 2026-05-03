import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { FeedbackThread } from '~/lib/db/services/feedback.server';
import { theme } from '~/theme';
import { FeedbackPage } from './feedback';

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
    status: 'reviewed',
    title: 'Saved filter presets',
    message: 'Please let me save several available-day filters.',
    context: 'Available Days',
    adminUpdates: [],
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
    ...overrides,
  };
}

function renderFeedbackPage(
  actionData: ComponentProps<typeof FeedbackPage>['actionData'],
  feedback: FeedbackThread[] = [createFeedback()],
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/feedback',
      action: async () => actionData ?? null,
      Component: () => (
        <MantineProvider theme={theme}>
          <FeedbackPage actionData={actionData} feedback={feedback} />
        </MantineProvider>
      ),
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/feedback']} />);
}

describe('FeedbackPage', () => {
  it('renders the feedback form and member history', () => {
    renderFeedbackPage(undefined);

    expect(
      screen.getByRole('heading', { name: 'Send feedback' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Your feedback' }),
    ).toBeVisible();
    expect(screen.getByText('Saved filter presets')).toBeVisible();
    expect(screen.getByText('No admin updates yet.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeVisible();
  });

  it('shows server validation errors without losing entered values', () => {
    renderFeedbackPage(
      {
        ok: false,
        formError: 'Check the highlighted fields and try again.',
        fieldErrors: {
          title: ['Title is required'],
        },
        values: {
          type: 'bug_report',
          title: '',
          message: 'The menu closes unexpectedly.',
          context: 'Mobile menu',
        },
      },
      [],
    );

    expect(
      screen.getByText('Check the highlighted fields and try again.'),
    ).toBeVisible();
    expect(
      screen.getByDisplayValue('The menu closes unexpectedly.'),
    ).toBeVisible();
    expect(screen.getByDisplayValue('Mobile menu')).toBeVisible();
  });

  it('renders admin update timelines and done status', () => {
    renderFeedbackPage(undefined, [
      createFeedback({
        status: 'closed',
        adminUpdates: [
          {
            updateId: 'update-1',
            status: 'planned',
            message: 'This is scheduled for the next release.',
            createdAt: '2026-05-04T09:00:00.000Z',
            authorName: 'Admin One',
          },
          {
            updateId: 'update-2',
            status: 'closed',
            message: 'This is now live.',
            createdAt: '2026-05-06T09:00:00.000Z',
            authorName: 'Admin One',
          },
        ],
      }),
    ]);

    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    expect(
      screen.getByText('This is scheduled for the next release.'),
    ).toBeVisible();
    expect(screen.getByText('This is now live.')).toBeVisible();
  });
});
