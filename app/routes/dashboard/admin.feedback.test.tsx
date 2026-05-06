import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));
const { listRecentFeedback, submitAdminFeedbackAction } = vi.hoisted(() => ({
  listRecentFeedback: vi.fn(),
  submitAdminFeedbackAction: vi.fn(),
}));
const { sendFeedbackUpdateEmail } = vi.hoisted(() => ({
  sendFeedbackUpdateEmail: vi.fn(),
}));
const { recordAppEventSafely } = vi.hoisted(() => ({
  recordAppEventSafely: vi.fn(),
}));

vi.mock('~/lib/auth/helpers.server', () => ({
  requireAdmin,
}));

vi.mock('~/lib/db/services/feedback.server', () => ({
  listRecentFeedback,
  submitAdminFeedbackAction,
}));

vi.mock('~/lib/email/feedback-update.server', () => ({
  sendFeedbackUpdateEmail,
}));

vi.mock('~/lib/db/services/app-event.server', () => ({
  recordAppEventSafely,
}));

import { action, loader } from './admin.feedback';

const feedback = {
  feedbackId: 'feedback-1',
  feedbackScope: 'feedback',
  userId: 'user-1',
  userName: 'Driver One',
  userEmail: 'driver@example.com',
  type: 'feature_request',
  status: 'planned',
  title: 'Saved filter presets',
  message: 'Please let me save several available-day filters.',
  adminUpdates: [],
  createdAt: '2026-05-03T10:00:00.000Z',
  updatedAt: '2026-05-03T10:00:00.000Z',
};

const adminUpdate = {
  updateId: 'update-1',
  status: 'planned',
  message: 'We have started work on this.',
  createdAt: '2026-05-04T10:00:00.000Z',
  authorUserId: 'admin-1',
  authorName: 'Admin One',
};

describe('admin feedback route', () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin One',
        role: 'admin',
      },
      headers: new Headers(),
    });
    listRecentFeedback.mockReset();
    listRecentFeedback.mockResolvedValue([feedback]);
    submitAdminFeedbackAction.mockReset();
    sendFeedbackUpdateEmail.mockReset();
    sendFeedbackUpdateEmail.mockResolvedValue(undefined);
    recordAppEventSafely.mockReset();
    recordAppEventSafely.mockResolvedValue(undefined);
  });

  it('loads the recent admin feedback queue', async () => {
    const response = (await loader({
      request: new Request('https://gridstay.app/dashboard/admin/feedback'),
      params: {},
      context: {},
    } as never)) as Response;

    expect(await response.json()).toEqual({ feedback: [feedback] });
    expect(listRecentFeedback).toHaveBeenCalledOnce();
  });

  it('records an audit event for status-only updates', async () => {
    submitAdminFeedbackAction.mockResolvedValue({
      ok: true,
      intent: 'saveStatus',
      message: 'Feedback status saved.',
      feedback: {
        ...feedback,
        status: 'reviewed',
      },
    });

    const formData = new FormData();
    formData.set('intent', 'saveStatus');
    formData.set('feedbackId', 'feedback-1');
    formData.set('status', 'reviewed');
    const request = new Request('https://gridstay.app/dashboard/admin/feedback', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(sendFeedbackUpdateEmail).not.toHaveBeenCalled();
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback.status.updated',
        subject: {
          type: 'feedback',
          id: 'feedback-1',
        },
        metadata: {
          status: 'reviewed',
        },
      }),
    );
  });

  it('emails the member after sending an admin update', async () => {
    submitAdminFeedbackAction.mockResolvedValue({
      ok: true,
      intent: 'sendUpdate',
      message: 'Feedback update saved.',
      feedback,
      update: adminUpdate,
    });

    const formData = new FormData();
    formData.set('intent', 'sendUpdate');
    formData.set('feedbackId', 'feedback-1');
    formData.set('status', 'planned');
    formData.set('message', 'We have started work on this.');
    const request = new Request('https://gridstay.app/dashboard/admin/feedback', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      message: 'Feedback update saved and emailed.',
    });
    expect(sendFeedbackUpdateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        feedback,
        update: adminUpdate,
      }),
    );
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback.update.saved',
        subject: {
          type: 'feedback',
          id: 'feedback-1',
        },
        metadata: {
          status: 'planned',
          updateId: 'update-1',
          emailWarning: false,
        },
      }),
    );
  });

  it('returns a warning and logs an error event if the member email fails', async () => {
    submitAdminFeedbackAction.mockResolvedValue({
      ok: true,
      intent: 'sendUpdate',
      message: 'Feedback update saved.',
      feedback,
      update: adminUpdate,
    });
    sendFeedbackUpdateEmail.mockRejectedValue(new Error('SES down'));

    const request = new Request('https://gridstay.app/dashboard/admin/feedback', {
      method: 'POST',
      body: new FormData(),
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      intent: 'sendUpdate',
      warning: 'The update was saved, but the member email could not be sent.',
    });
    expect(recordAppEventSafely).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        category: 'error',
        action: 'feedback.update.email.failed',
      }),
    );
    expect(recordAppEventSafely).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'feedback.update.saved',
        metadata: {
          status: 'planned',
          updateId: 'update-1',
          emailWarning: true,
        },
      }),
    );
  });

  it('records an audit event for hard deletes', async () => {
    submitAdminFeedbackAction.mockResolvedValue({
      ok: true,
      intent: 'deleteFeedback',
      message: 'Feedback deleted.',
      feedbackId: 'feedback-1',
      deletedFeedback: feedback,
    });

    const formData = new FormData();
    formData.set('intent', 'deleteFeedback');
    formData.set('feedbackId', 'feedback-1');
    const request = new Request('https://gridstay.app/dashboard/admin/feedback', {
      method: 'POST',
      body: formData,
    });

    const response = (await action({
      request,
      params: {},
      context: {},
    } as never)) as Response;

    expect(response.status).toBe(200);
    expect(sendFeedbackUpdateEmail).not.toHaveBeenCalled();
    expect(recordAppEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'feedback.deleted',
        subject: {
          type: 'feedback',
          id: 'feedback-1',
        },
      }),
    );
  });
});
