import { ulid } from 'ulid';
import type { User } from '~/lib/auth/schemas';
import {
  type DeleteFeedbackInput,
  DeleteFeedbackSchema,
  FeedbackAdminUpdateListSchema,
  type SaveFeedbackStatusInput,
  SaveFeedbackStatusSchema,
  type FeedbackAdminUpdate as SchemaFeedbackAdminUpdate,
  type SendFeedbackUpdateInput,
  SendFeedbackUpdateSchema,
  type SubmitFeedbackInput,
  SubmitFeedbackSchema,
} from '~/lib/schemas/feedback';
import {
  FeedbackEntity,
  type FeedbackRecord,
} from '../entities/feedback.server';

export const FEEDBACK_SCOPE = 'feedback';

export type FeedbackAdminUpdate = SchemaFeedbackAdminUpdate;
export type FeedbackThread = Omit<FeedbackRecord, 'adminUpdatesJson'> & {
  adminUpdates: FeedbackAdminUpdate[];
};

export interface FeedbackPersistence {
  create(item: FeedbackRecord): Promise<FeedbackRecord>;
  update(
    feedbackId: string,
    changes: Partial<FeedbackRecord>,
  ): Promise<FeedbackRecord>;
  delete(feedbackId: string): Promise<void>;
  getById(feedbackId: string): Promise<FeedbackRecord | null>;
  listAll(): Promise<FeedbackRecord[]>;
  listByUser(userId: string): Promise<FeedbackRecord[]>;
}

export type FeedbackActionResult =
  | {
      ok: true;
      message: string;
      feedback: FeedbackThread;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<keyof SubmitFeedbackInput, string[]>>;
      values: Partial<Record<keyof SubmitFeedbackInput, string>>;
    };

type FeedbackAdminFieldName =
  | keyof SaveFeedbackStatusInput
  | keyof SendFeedbackUpdateInput
  | keyof DeleteFeedbackInput;

export type AdminFeedbackActionResult =
  | {
      ok: true;
      intent: 'saveStatus';
      message: string;
      feedback: FeedbackThread;
    }
  | {
      ok: true;
      intent: 'sendUpdate';
      message: string;
      feedback: FeedbackThread;
      update: FeedbackAdminUpdate;
      warning?: string;
    }
  | {
      ok: true;
      intent: 'deleteFeedback';
      message: string;
      feedbackId: string;
      deletedFeedback: FeedbackThread;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<FeedbackAdminFieldName, string[]>>;
    };

export const feedbackStore: FeedbackPersistence = {
  async create(item) {
    await FeedbackEntity.create(item).go({ response: 'none' });
    return item;
  },
  async update(feedbackId, changes) {
    const updated = await FeedbackEntity.patch({
      feedbackId,
      feedbackScope: FEEDBACK_SCOPE,
    })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async delete(feedbackId) {
    await FeedbackEntity.delete({
      feedbackId,
      feedbackScope: FEEDBACK_SCOPE,
    }).go({ response: 'none' });
  },
  async getById(feedbackId) {
    const response = await FeedbackEntity.get({
      feedbackId,
      feedbackScope: FEEDBACK_SCOPE,
    }).go();
    return response.data ?? null;
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

function parseAdminUpdates(adminUpdatesJson?: string): FeedbackAdminUpdate[] {
  if (!adminUpdatesJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(adminUpdatesJson) as unknown;
    const result = FeedbackAdminUpdateListSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function serializeAdminUpdates(
  updates: FeedbackAdminUpdate[],
): string | undefined {
  if (updates.length === 0) {
    return undefined;
  }

  return JSON.stringify(updates);
}

function toFeedbackThread(record: FeedbackRecord): FeedbackThread {
  const { adminUpdatesJson, ...feedback } = record;

  return {
    ...feedback,
    adminUpdates: parseAdminUpdates(adminUpdatesJson),
  };
}

function createRecord(
  input: SubmitFeedbackInput,
  user: User,
  createdAt = new Date().toISOString(),
): FeedbackThread {
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
    adminUpdates: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function toFeedbackRecord(thread: FeedbackThread): FeedbackRecord {
  const { adminUpdates, ...feedback } = thread;

  return {
    ...feedback,
    adminUpdatesJson: serializeAdminUpdates(adminUpdates),
  } as FeedbackRecord;
}

function createNotFoundError() {
  return new Response('Feedback not found', { status: 404 });
}

async function loadExistingFeedback(
  feedbackId: string,
  store: FeedbackPersistence,
): Promise<FeedbackRecord> {
  const feedback = await store.getById(feedbackId);

  if (!feedback) {
    throw createNotFoundError();
  }

  return feedback;
}

function toNotFoundResult(message: string): AdminFeedbackActionResult {
  return {
    ok: false,
    formError: message,
    fieldErrors: {
      feedbackId: ['This feedback item no longer exists.'],
    },
  };
}

export async function createFeedbackSubmission(
  input: SubmitFeedbackInput,
  user: User,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackThread> {
  const created = await store.create(
    toFeedbackRecord(createRecord(input, user)),
  );
  return toFeedbackThread(created);
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

export async function updateFeedbackStatus(
  input: SaveFeedbackStatusInput,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackThread> {
  await loadExistingFeedback(input.feedbackId, store);

  const updated = await store.update(input.feedbackId, {
    status: input.status,
    updatedAt: new Date().toISOString(),
  });

  return toFeedbackThread(updated);
}

export async function sendFeedbackUpdate(
  input: SendFeedbackUpdateInput,
  user: Pick<User, 'id' | 'name'>,
  store: FeedbackPersistence = feedbackStore,
): Promise<{ feedback: FeedbackThread; update: FeedbackAdminUpdate }> {
  const existing = await loadExistingFeedback(input.feedbackId, store);
  const updates = parseAdminUpdates(existing.adminUpdatesJson);
  const createdAt = new Date().toISOString();
  const update: FeedbackAdminUpdate = {
    updateId: ulid(),
    status: input.status,
    message: input.message,
    createdAt,
    authorUserId: user.id,
    authorName: user.name,
  };

  const updated = await store.update(input.feedbackId, {
    status: input.status,
    adminUpdatesJson: serializeAdminUpdates([...updates, update]),
    updatedAt: createdAt,
  });

  return {
    feedback: toFeedbackThread(updated),
    update,
  };
}

export async function deleteFeedback(
  feedbackId: string,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackThread> {
  const existing = await loadExistingFeedback(feedbackId, store);
  await store.delete(feedbackId);
  return toFeedbackThread(existing);
}

export async function submitAdminFeedbackAction(
  formData: FormData,
  user: Pick<User, 'id' | 'name'>,
  store: FeedbackPersistence = feedbackStore,
): Promise<AdminFeedbackActionResult> {
  const intent = formData.get('intent');

  try {
    if (intent === 'saveStatus') {
      const parsed = SaveFeedbackStatusSchema.safeParse(
        Object.fromEntries(formData),
      );

      if (!parsed.success) {
        return {
          ok: false,
          formError: 'Could not save this feedback status yet.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }

      return {
        ok: true,
        intent,
        message: 'Feedback status saved.',
        feedback: await updateFeedbackStatus(parsed.data, store),
      };
    }

    if (intent === 'sendUpdate') {
      const parsed = SendFeedbackUpdateSchema.safeParse(
        Object.fromEntries(formData),
      );

      if (!parsed.success) {
        return {
          ok: false,
          formError: 'Could not send this feedback update yet.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }

      const result = await sendFeedbackUpdate(parsed.data, user, store);

      return {
        ok: true,
        intent,
        message: 'Feedback update saved.',
        ...result,
      };
    }

    if (intent === 'deleteFeedback') {
      const parsed = DeleteFeedbackSchema.safeParse(
        Object.fromEntries(formData),
      );

      if (!parsed.success) {
        return {
          ok: false,
          formError: 'Could not delete this feedback yet.',
          fieldErrors: parsed.error.flatten().fieldErrors,
        };
      }

      return {
        ok: true,
        intent,
        message: 'Feedback deleted.',
        feedbackId: parsed.data.feedbackId,
        deletedFeedback: await deleteFeedback(parsed.data.feedbackId, store),
      };
    }
  } catch (error) {
    if (error instanceof Response && error.status === 404) {
      if (intent === 'deleteFeedback') {
        return toNotFoundResult('Could not delete this feedback yet.');
      }
      if (intent === 'sendUpdate') {
        return toNotFoundResult('Could not send this feedback update yet.');
      }
      return toNotFoundResult('Could not save this feedback status yet.');
    }

    throw error;
  }

  return {
    ok: false,
    formError: 'This feedback action is not supported.',
    fieldErrors: {},
  };
}

export async function listRecentFeedback(
  limit = 100,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackThread[]> {
  const records = await store.listAll();
  return records.sort(sortNewestFirst).slice(0, limit).map(toFeedbackThread);
}

export async function listMyFeedback(
  userId: string,
  limit = 20,
  store: FeedbackPersistence = feedbackStore,
): Promise<FeedbackThread[]> {
  const records = await store.listByUser(userId);
  return records.sort(sortNewestFirst).slice(0, limit).map(toFeedbackThread);
}
