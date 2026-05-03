import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import {
  type SubmitFeedbackInput,
  SubmitFeedbackSchema,
} from '~/lib/schemas/feedback';
import {
  FeedbackEntity,
  type FeedbackRecord,
} from '../entities/feedback.server';

export const FEEDBACK_SCOPE = 'feedback';

export interface FeedbackPersistence {
  create(item: FeedbackRecord): Promise<FeedbackRecord>;
  listAll(): Promise<FeedbackRecord[]>;
  listByUser(userId: string): Promise<FeedbackRecord[]>;
}

export type FeedbackActionResult =
  | {
      ok: true;
      message: string;
      feedback: FeedbackRecord;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<keyof SubmitFeedbackInput, string[]>>;
      values: Partial<Record<keyof SubmitFeedbackInput, string>>;
    };

export const feedbackStore: FeedbackPersistence = {
  async create(item) {
    await FeedbackEntity.create(item).go({ response: 'none' });
    return item;
  },
  async listAll() {
    const response = await FeedbackEntity.query
      .byScope({ feedbackScope: FEEDBACK_SCOPE })
      .go();
    return response.data;
  },
  async listByUser(userId) {
    const response = await FeedbackEntity.query.byUser({ userId }).go();
    return response.data;
  },
};

function getFormValue(formData: FormData, key: keyof SubmitFeedbackInput) {
  return formData.get(key)?.toString() ?? '';
}

function getSubmittedValues(formData: FormData) {
  return {
    type: getFormValue(formData, 'type'),
    title: getFormValue(formData, 'title'),
    message: getFormValue(formData, 'message'),
    context: getFormValue(formData, 'context'),
  };
}

function sortNewestFirst(left: FeedbackRecord, right: FeedbackRecord) {
  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return right.feedbackId.localeCompare(left.feedbackId);
}

function createRecord(
  input: SubmitFeedbackInput,
  user: User,
  createdAt = new Date().toISOString(),
): FeedbackRecord {
  return {
    feedbackId: ulid(),
    feedbackScope: FEEDBACK_SCOPE,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    type: input.type,
    status: 'new',
    title: input.title,
    message: input.message,
    context: input.context || undefined,
    createdAt,
    updatedAt: createdAt,
  } as FeedbackRecord;
}

export async function createFeedbackSubmission(
  input: SubmitFeedbackInput,
  user: User,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackRecord> {
  return store.create(createRecord(input, user));
}

export async function submitFeedbackAction(
  formData: FormData,
  user: User,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackActionResult> {
  const values = getSubmittedValues(formData);
  const parsed = SubmitFeedbackSchema.safeParse(values);

  if (!parsed.success) {
    return {
      ok: false,
      formError: 'Check the highlighted fields and try again.',
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const feedback = await createFeedbackSubmission(parsed.data, user, store);

  return {
    ok: true,
    message: 'Thanks, your feedback has been sent.',
    feedback,
  };
}

export async function listRecentFeedback(
  limit = 100,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackRecord[]> {
  const records = await store.listAll();
  return records.sort(sortNewestFirst).slice(0, limit);
}

export async function listMyFeedback(
  userId: string,
  limit = 20,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackRecord[]> {
  const records = await store.listByUser(userId);
  return records.sort(sortNewestFirst).slice(0, limit);
}
