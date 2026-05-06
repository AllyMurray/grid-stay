import { describe, expect, it, vi } from 'vite-plus/test';
import type { User } from '~/lib/auth/schemas';

vi.mock('../entities/feedback.server', () => ({
  FeedbackEntity: {},
}));

import type { FeedbackRecord } from '../entities/feedback.server';
import {
  deleteFeedback,
  FEEDBACK_SCOPE,
  type FeedbackPersistence,
  listMyFeedback,
  listRecentFeedback,
  sendFeedbackUpdate,
  submitAdminFeedbackAction,
  submitFeedbackAction,
  updateFeedbackStatus,
} from './feedback.server';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

const admin = {
  id: 'admin-1',
  name: 'Admin One',
} as const;

function createRecord(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    feedbackId: 'feedback-1',
    feedbackScope: FEEDBACK_SCOPE,
    userId: 'user-1',
    userName: 'Driver One',
    userEmail: 'driver@example.com',
    type: 'feedback',
    status: 'new',
    title: 'First',
    message: 'The first feedback item.',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  } as FeedbackRecord;
}

function createMemoryStore(initialItems: FeedbackRecord[] = []) {
  const items = [...initialItems];
  const store: FeedbackPersistence = {
    async create(item) {
      items.push(item);
      return item;
    },
    async update(feedbackId, changes) {
      const index = items.findIndex((item) => item.feedbackId === feedbackId);

      if (index === -1) {
        throw new Error(`Missing feedback ${feedbackId}`);
      }

      items[index] = {
        ...items[index],
        ...changes,
      } as FeedbackRecord;

      return items[index]!;
    },
    async delete(feedbackId) {
      const index = items.findIndex((item) => item.feedbackId === feedbackId);

      if (index >= 0) {
        items.splice(index, 1);
      }
    },
    async getById(feedbackId) {
      return items.find((item) => item.feedbackId === feedbackId) ?? null;
    },
    async listAll() {
      return [...items];
    },
    async listByUser(userId) {
      return items.filter((item) => item.userId === userId);
    },
  };

  return { items, store };
}

describe('feedback service', () => {
  it('creates a feedback submission from form data', async () => {
    const memory = createMemoryStore();
    const formData = new FormData();
    formData.set('type', 'feature_request');
    formData.set('title', 'Improve filtering');
    formData.set('message', 'Please let me save a few different filter presets.');
    formData.set('context', 'Available Days');

    const result = await submitFeedbackAction(formData, user, memory.store);

    expect(result).toMatchObject({
      ok: true,
      message: 'Thanks, your feedback has been sent.',
      feedback: {
        feedbackScope: FEEDBACK_SCOPE,
        userId: 'user-1',
        userEmail: 'driver@example.com',
        type: 'feature_request',
        status: 'new',
        title: 'Improve filtering',
        context: 'Available Days',
        adminUpdates: [],
      },
    });
    expect(memory.items[0]?.adminUpdatesJson).toBeUndefined();
  });

  it('returns field errors for invalid submissions', async () => {
    const memory = createMemoryStore();
    const formData = new FormData();
    formData.set('type', 'feature_request');
    formData.set('title', '');
    formData.set('message', 'Too short');

    const result = await submitFeedbackAction(formData, user, memory.store);

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        title: expect.any(Array),
        message: expect.any(Array),
      },
    });
    expect(memory.items).toHaveLength(0);
  });

  it('lists recent feedback newest first', async () => {
    const memory = createMemoryStore([
      createRecord(),
      createRecord({
        feedbackId: 'feedback-2',
        title: 'Second',
        createdAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:00.000Z',
      }),
    ]);

    await expect(listRecentFeedback(1, memory.store)).resolves.toMatchObject([
      { feedbackId: 'feedback-2' },
    ]);
  });

  it('parses stored admin updates into feedback threads', async () => {
    const memory = createMemoryStore([
      createRecord({
        adminUpdatesJson: JSON.stringify([
          {
            updateId: 'update-1',
            status: 'planned',
            message: 'We have added this to the roadmap.',
            createdAt: '2026-05-02T12:00:00.000Z',
            authorName: 'Admin One',
          },
        ]),
      }),
    ]);

    await expect(listMyFeedback('user-1', 20, memory.store)).resolves.toEqual([
      expect.objectContaining({
        feedbackId: 'feedback-1',
        adminUpdates: [
          expect.objectContaining({
            updateId: 'update-1',
            status: 'planned',
            message: 'We have added this to the roadmap.',
          }),
        ],
      }),
    ]);
  });

  it('updates feedback status without changing the update timeline', async () => {
    const memory = createMemoryStore([createRecord()]);

    const updated = await updateFeedbackStatus(
      {
        feedbackId: 'feedback-1',
        status: 'reviewed',
      },
      memory.store,
    );

    expect(updated).toMatchObject({
      feedbackId: 'feedback-1',
      status: 'reviewed',
      adminUpdates: [],
    });
    expect(memory.items[0]?.status).toBe('reviewed');
    expect(memory.items[0]?.updatedAt).not.toBe('2026-05-01T10:00:00.000Z');
  });

  it('appends multiple admin updates in chronological order', async () => {
    const memory = createMemoryStore([createRecord()]);

    await sendFeedbackUpdate(
      {
        feedbackId: 'feedback-1',
        status: 'planned',
        message: 'We have started work on this.',
      },
      admin,
      memory.store,
    );
    const second = await sendFeedbackUpdate(
      {
        feedbackId: 'feedback-1',
        status: 'closed',
        message: 'This is now shipped.',
      },
      admin,
      memory.store,
    );

    expect(second.feedback.adminUpdates).toHaveLength(2);
    expect(second.feedback.adminUpdates.map((update) => update.message)).toEqual([
      'We have started work on this.',
      'This is now shipped.',
    ]);

    const stored = await listMyFeedback('user-1', 20, memory.store);
    expect(stored[0]?.adminUpdates).toHaveLength(2);
    expect(stored[0]?.status).toBe('closed');
  });

  it('deletes feedback records', async () => {
    const memory = createMemoryStore([createRecord()]);

    const deleted = await deleteFeedback('feedback-1', memory.store);

    expect(deleted.feedbackId).toBe('feedback-1');
    expect(memory.items).toHaveLength(0);
  });

  it('raises a not found response when updating a missing feedback item', async () => {
    const memory = createMemoryStore();

    await expect(
      updateFeedbackStatus(
        {
          feedbackId: 'missing',
          status: 'reviewed',
        },
        memory.store,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('returns a form error when an admin action targets missing feedback', async () => {
    const memory = createMemoryStore();
    const formData = new FormData();
    formData.set('intent', 'deleteFeedback');
    formData.set('feedbackId', 'missing');

    await expect(submitAdminFeedbackAction(formData, admin, memory.store)).resolves.toMatchObject({
      ok: false,
      formError: 'Could not delete this feedback yet.',
      fieldErrors: {
        feedbackId: ['This feedback item no longer exists.'],
      },
    });
  });
});
