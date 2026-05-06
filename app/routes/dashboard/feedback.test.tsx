import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireUser } = vi.hoisted(() => ({
  requireUser: vi.fn(),
}));
const { listMyFeedback, submitFeedbackAction } = vi.hoisted(() => ({
  listMyFeedback: vi.fn(),
  submitFeedbackAction: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireUser,
}));

vi.mock('~/lib/db/services/feedback.server', () => ({
  listMyFeedback,
  submitFeedbackAction,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './feedback';

const feedback = {
  feedbackId: 'feedback-1',
  feedbackScope: 'feedback',
  userId: 'user-1',
  userName: 'Driver One',
  userEmail: 'driver@example.com',
  type: 'feature_request',
  status: 'new',
  title: 'Saved filter presets',
  message: 'Please let me save several available-day filters.',
  adminUpdates: [],
  createdAt: '2026-05-03T10:00:00.000Z',
  updatedAt: '2026-05-03T10:00:00.000Z',
};

describe('feedback route', () => {
  beforeEach(() => {
    requireUser.mockReset();
    requireUser.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'driver@example.com',
        name: 'Driver One',
        role: 'member',
      },
      headers: new Headers(),
    });
    listMyFeedback.mockReset();
    listMyFeedback.mockResolvedValue([feedback]);
    submitFeedbackAction.mockReset();
    submitFeedbackAction.mockResolvedValue({
      ok: true,
      message: 'Thanks, your feedback has been sent.',
      feedback,
    });
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads the current member feedback history', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/feedback'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({ feedback: [feedback] });
    expect(listMyFeedback).toHaveBeenCalledWith('user-1');
  });

  it('records an audit event after successful submissions', async () => {
    const formData = new FormData();
    formData.set('type', 'feature_request');
    formData.set('title', 'Saved filter presets');
    formData.set('message', 'Please let me save several available-day filters.');
    const request = new Request('https://gridstay.app/dashboard/feedback', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback.submitted',
        subject: {
          type: 'feedback',
          id: 'feedback-1',
        },
        metadata: {
          feedbackType: 'feature_request',
        },
      }),
    );
  });

  it('returns validation errors without recording an audit event', async () => {
    submitFeedbackAction.mockResolvedValue({
      ok: false,
      formError: 'Check the highlighted fields and try again.',
      fieldErrors: {
        title: ['Title is required.'],
      },
      values: {
        type: 'feature_request',
        title: '',
        message: 'Too short',
        context: '',
      },
    });

    const request = new Request('https://gridstay.app/dashboard/feedback', {
      method: 'POST',
      body: new FormData(),
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(400);
    expect(recordAppEventSafely).not.toHaveBeenCalled();
  });
});
