import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FeedbackRecord } from '~/lib/db/entities/feedback.server';
import { theme } from '~/theme';
import { AdminFeedbackPage } from './admin-feedback';

const feedback: FeedbackRecord[] = [
  {
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
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
  },
] as FeedbackRecord[];

function renderAdminFeedbackPage(items = feedback) {
  return render(
    <MantineProvider theme={theme}>
      <AdminFeedbackPage feedback={items} />
    </MantineProvider>,
  );
}

describe('AdminFeedbackPage', () => {
  it('renders member feedback for admin review', () => {
    renderAdminFeedbackPage();

    expect(screen.getByRole('heading', { name: 'Feedback' })).toBeVisible();
    expect(screen.getByText('Saved filter presets')).toBeVisible();
    expect(screen.getByText(/Driver One · driver@example.com/)).toBeVisible();
    expect(screen.getByText('Context: Available Days')).toBeVisible();
    expect(screen.getByText('Feature Request')).toBeVisible();
  });

  it('renders an empty state when no feedback has been submitted', () => {
    renderAdminFeedbackPage([]);

    expect(screen.getByText('No feedback yet')).toBeVisible();
  });
});
