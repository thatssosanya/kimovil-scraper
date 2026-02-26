import { BaseStorage, createStorage, StorageType } from '@src/shared/storages/base';
import type { YandexLinkResult } from '@src/services/LinkService';

interface CachedYandexLinkEntry extends YandexLinkResult {
  timestamp: number;
}

interface YandexLinkCacheState {
  byAuthor: Record<string, Record<string, CachedYandexLinkEntry>>;
}

type YandexLinkCacheStorage = BaseStorage<YandexLinkCacheState> & {
  getByAuthorAndUrl: (authorId: string, url: string) => YandexLinkResult | null;
  saveByAuthorAndUrl: (authorId: string, url: string, links: YandexLinkResult) => Promise<void>;
};

const storage = createStorage<YandexLinkCacheState>(
  'yandex-url-link-cache',
  { byAuthor: {} },
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  },
);

const MAX_CACHE_AGE = 48 * 60 * 60 * 1000;
const MAX_LINKS_PER_AUTHOR = 200;

const normalizeUrl = (url: string): string => url.trim();

const yandexLinkCacheStorage: YandexLinkCacheStorage = {
  ...storage,

  getByAuthorAndUrl: (authorId: string, url: string) => {
    const state = storage.getSnapshot();
    if (!state) return null;

    const normalizedUrl = normalizeUrl(url);
    const links = state.byAuthor[authorId]?.[normalizedUrl];
    if (!links) return null;

    if (Date.now() - links.timestamp > MAX_CACHE_AGE) {
      return null;
    }

    return {
      siteLink: links.siteLink,
      siteLinkLong: links.siteLinkLong,
      telegramLink: links.telegramLink,
      telegramLinkLong: links.telegramLinkLong,
    };
  },

  saveByAuthorAndUrl: async (authorId: string, url: string, links: YandexLinkResult) => {
    const normalizedUrl = normalizeUrl(url);

    await storage.set((state) => {
      const nextState: YandexLinkCacheState = {
        ...state,
        byAuthor: {
          ...state.byAuthor,
          [authorId]: {
            ...(state.byAuthor[authorId] ?? {}),
            [normalizedUrl]: {
              ...links,
              timestamp: Date.now(),
            },
          },
        },
      };

      const authorLinks = nextState.byAuthor[authorId];
      const entries = Object.entries(authorLinks);
      if (entries.length > MAX_LINKS_PER_AUTHOR) {
        entries.sort(([, a], [, b]) => b.timestamp - a.timestamp);
        nextState.byAuthor[authorId] = Object.fromEntries(
          entries.slice(0, MAX_LINKS_PER_AUTHOR),
        );
      }

      return nextState;
    });
  },
};

export default yandexLinkCacheStorage;
