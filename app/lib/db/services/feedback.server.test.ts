import { describe, expect, it, vi } from 'vitest';
import type { User } from '~/lib/auth/schemas';

vi.mock('../entities/feedback.server', () => ({
  FeedbackEntity: {},
}));

import type { FeedbackRecord } from '../entities/feedback.server';
import {
  FEEDBACK_SCOPE,
  type FeedbackPersistence,
  listRecentFeedback,
  submitFeedbackAction,
} from './feedback.server';

const user: User = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Driver One',
  role: 'member',
};

function createMemoryStore() {
  const items: FeedbackRecord[] = [];
  const store: FeedbackPersistence = {
    async create(item) {
      items.push(item);
      return item;
    },
    async listAll() {
      return items;
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
    formData.set(
      'message',
      'Please let me save a few different filter presets.',
    );
    formData.set('context', 'Available Days');

    const result = await submitFeedbackAction(formData, user, memory.store);

    expect(result).toMatchObject({
      ok: true,
      message: 'Thanks, your feedback has been sent.',
    });
    expect(memory.items[0]).toMatchObject({
      feedbackScope: FEEDBACK_SCOPE,
      userId: 'user-1',
      userEmail: 'driver@example.com',
      type: 'feature_request',
      status: 'new',
      title: 'Improve filtering',
      context: 'Available Days',
    });
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
    const memory = createMemoryStore();
    const first = {
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
    } as FeedbackRecord;
    const second = {
      ...first,
      feedbackId: 'feedback-2',
      title: 'Second',
      createdAt: '2026-05-02T10:00:00.000Z',
      updatedAt: '2026-05-02T10:00:00.000Z',
    } as FeedbackRecord;
    memory.items.push(first, second);

    await expect(listRecentFeedback(1, memory.store)).resolves.toMatchObject([
      { feedbackId: 'feedback-2' },
    ]);
  });
});
