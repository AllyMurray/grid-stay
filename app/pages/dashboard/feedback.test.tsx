import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { theme } from '~/theme';
import { FeedbackPage } from './feedback';

function renderFeedbackPage(
  actionData: ComponentProps<typeof FeedbackPage>['actionData'],
) {
  const Stub = createRoutesStub([
    {
      path: '/dashboard/feedback',
      action: async () => actionData ?? null,
      Component: () => (
        <MantineProvider theme={theme}>
          <FeedbackPage actionData={actionData} />
        </MantineProvider>
      ),
    },
  ]);

  return render(<Stub initialEntries={['/dashboard/feedback']} />);
}

describe('FeedbackPage', () => {
  it('renders a feedback and feature request form', () => {
    renderFeedbackPage(undefined);

    expect(
      screen.getByRole('heading', { name: 'Send feedback' }),
    ).toBeVisible();
    expect(screen.getByText('Request type')).toBeVisible();
    expect(screen.getByText('Short title')).toBeVisible();
    expect(screen.getByText('Details')).toBeVisible();
    expect(screen.getByText('Relevant page or workflow')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeVisible();
  });

  it('shows server validation errors without losing entered values', () => {
    renderFeedbackPage({
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
    });

    expect(
      screen.getByText('Check the highlighted fields and try again.'),
    ).toBeVisible();
    expect(
      screen.getByDisplayValue('The menu closes unexpectedly.'),
    ).toBeVisible();
    expect(screen.getByDisplayValue('Mobile menu')).toBeVisible();
  });
});
