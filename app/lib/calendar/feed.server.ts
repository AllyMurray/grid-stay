import { createHash, randomBytes } from 'node:crypto';
import {
  CalendarFeedEntity,
  type CalendarFeedRecord,
} from '~/lib/db/entities/calendar-feed.server';

const calendarFeedScope = 'schedule';

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

function getActiveFeed(feeds: CalendarFeedRecord[]) {
  return (
    feeds
      .filter((feed) => !feed.revokedAt)
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0] ?? null
  );
}

async function createCalendarFeed(
  userId: string,
  store: CalendarFeedPersistence,
  tokenFactory: () => string,
): Promise<CalendarFeedRecord> {
  const token = tokenFactory();
  const now = new Date().toISOString();

  return store.create({
    token,
    tokenHash: hashCalendarFeedToken(token),
    feedScope: calendarFeedScope,
    userId,
    createdAt: now,
    updatedAt: now,
    revokedAt: undefined,
  } as CalendarFeedRecord);
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
) {
  const activeFeed = await getActiveCalendarFeedForUser(userId, store);
  return activeFeed ?? createCalendarFeed(userId, store, tokenFactory);
}

export async function regenerateCalendarFeedForUser(
  userId: string,
  store: CalendarFeedPersistence = calendarFeedStore,
  tokenFactory = createCalendarFeedToken,
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

  return createCalendarFeed(userId, store, tokenFactory);
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
