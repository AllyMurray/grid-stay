import { createHash, randomBytes } from 'node:crypto';
import {
  CalendarFeedEntity,
  type CalendarFeedRecord,
} from '~/lib/db/entities/calendar-feed.server';

const calendarFeedScope = 'schedule';

export interface CalendarFeedOptions {
  includeMaybe: boolean;
  includeStay: boolean;
}

export interface CalendarFeedPersistence {
  create(item: CalendarFeedRecord): Promise<CalendarFeedRecord>;
  update(
    tokenHash: string,
    feedScope: string,
    changes: Partial<CalendarFeedRecord>,
  ): Promise<CalendarFeedRecord>;
  getByTokenHash(tokenHash: string): Promise<CalendarFeedRecord | null>;
  listByUser(userId: string): Promise<CalendarFeedRecord[]>;
}

export const calendarFeedStore: CalendarFeedPersistence = {
  async create(item) {
    await CalendarFeedEntity.create(item).go({ response: 'none' });
    return item;
  },
  async update(tokenHash, feedScope, changes) {
    const updated = await CalendarFeedEntity.patch({ tokenHash, feedScope })
      .set(changes)
      .go({ response: 'all_new' });
    return updated.data;
  },
  async getByTokenHash(tokenHash) {
    const response = await CalendarFeedEntity.get({
      tokenHash,
      feedScope: calendarFeedScope,
    }).go();
    return response.data ?? null;
  },
  async listByUser(userId) {
    const response = await CalendarFeedEntity.query.byUser({ userId }).go();
    return response.data;
  },
};

export function hashCalendarFeedToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createCalendarFeedToken() {
  return randomBytes(32).toString('base64url');
}

export function createCalendarFeedTokenHint(token: string) {
  return token.slice(-8);
}

export function getCalendarFeedOptions(
  feed: Pick<CalendarFeedRecord, 'includeMaybe' | 'includeStay'> | null,
): CalendarFeedOptions {
  return {
    includeMaybe: feed?.includeMaybe ?? true,
    includeStay: feed?.includeStay ?? true,
  };
}

export function parseCalendarFeedOptionsFromFormData(formData: FormData): CalendarFeedOptions {
  const parseBoolean = (name: string, fallback: boolean) => {
    const values = formData.getAll(name).map((value) => String(value));

    if (values.length === 0) {
      return fallback;
    }

    return values.includes('true') || values.includes('on');
  };

  return {
    includeMaybe: parseBoolean('includeMaybe', true),
    includeStay: parseBoolean('includeStay', true),
  };
}

function getActiveFeed(feeds: CalendarFeedRecord[]) {
  return (
    feeds
      .filter((feed) => !feed.revokedAt)
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

async function createCalendarFeed(
  userId: string,
  store: CalendarFeedPersistence,
  tokenFactory: () => string,
  options: CalendarFeedOptions,
): Promise<CalendarFeedRecord> {
  const token = tokenFactory();
  const now = new Date().toISOString();
  const tokenHash = hashCalendarFeedToken(token);
  const tokenHint = createCalendarFeedTokenHint(token);

  const record = await store.create({
    tokenHash,
    tokenHint,
    feedScope: calendarFeedScope,
    userId,
    includeMaybe: options.includeMaybe,
    includeStay: options.includeStay,
    createdAt: now,
    updatedAt: now,
    revokedAt: undefined,
  } as CalendarFeedRecord);

  return {
    ...record,
    token,
  };
}

export async function getActiveCalendarFeedForUser(
  userId: string,
  store: CalendarFeedPersistence = calendarFeedStore,
) {
  return getActiveFeed(await store.listByUser(userId));
}

export async function ensureCalendarFeedForUser(
  userId: string,
  store: CalendarFeedPersistence = calendarFeedStore,
  tokenFactory = createCalendarFeedToken,
  options: CalendarFeedOptions = { includeMaybe: true, includeStay: true },
) {
  const activeFeed = await getActiveCalendarFeedForUser(userId, store);
  if (!activeFeed) {
    return createCalendarFeed(userId, store, tokenFactory, options);
  }

  const currentOptions = getCalendarFeedOptions(activeFeed);
  if (
    currentOptions.includeMaybe === options.includeMaybe &&
    currentOptions.includeStay === options.includeStay
  ) {
    return activeFeed;
  }

  return store.update(activeFeed.tokenHash, activeFeed.feedScope, {
    includeMaybe: options.includeMaybe,
    includeStay: options.includeStay,
    updatedAt: new Date().toISOString(),
  });
}

export async function regenerateCalendarFeedForUser(
  userId: string,
  store: CalendarFeedPersistence = calendarFeedStore,
  tokenFactory = createCalendarFeedToken,
  options: CalendarFeedOptions = { includeMaybe: true, includeStay: true },
) {
  const now = new Date().toISOString();
  const feeds = await store.listByUser(userId);
  await Promise.all(
    feeds
      .filter((feed) => !feed.revokedAt)
      .map((feed) =>
        store.update(feed.tokenHash, feed.feedScope, {
          revokedAt: now,
          updatedAt: now,
        }),
      ),
  );

  return createCalendarFeed(userId, store, tokenFactory, options);
}

export async function saveCalendarFeedOptionsForUser(
  userId: string,
  options: CalendarFeedOptions,
  store: CalendarFeedPersistence = calendarFeedStore,
  tokenFactory = createCalendarFeedToken,
) {
  return ensureCalendarFeedForUser(userId, store, tokenFactory, options);
}

export async function getActiveCalendarFeedByToken(
  token: string,
  store: CalendarFeedPersistence = calendarFeedStore,
) {
  const feed = await store.getByTokenHash(hashCalendarFeedToken(token));

  if (!feed || feed.revokedAt) {
    return null;
  }

  return feed;
}

export function stripCalendarFeedTokenSuffix(token: string) {
  return token.endsWith('.ics') ? token.slice(0, -4) : token;
}

export function buildCalendarFeedUrl(request: Request, token: string) {
  const url = new URL(request.url);
  url.pathname = `/calendar/${token}.ics`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
