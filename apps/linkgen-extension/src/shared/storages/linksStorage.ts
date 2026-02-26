import { BaseStorage, createStorage, StorageType } from '@src/shared/storages/base';

export interface GeneratedLinks {
  siteLink: string;
  siteLinkLong?: string;
  telegramLink: string;
  telegramLinkLong?: string;
  timestamp: number;
  // AliExpress specific fields
  aliExpressLink?: string;
  aliExpressLinkLong?: string;
  commissionRate?: number;
  hotCommissionRate?: number;
  isHot?: boolean;
  productName?: string;
  // Price.ru specific fields
  priceRuLink?: string;
  priceRuLinkLong?: string;
  linkType?: 'yandex' | 'aliexpress' | 'priceru';
}

export interface TabLinkCache {
  [tabId: number]: {
    [authorId: string]: GeneratedLinks;
  };
}

type LinksState = {
  tabLinks: TabLinkCache;
};

type LinksStorage = BaseStorage<LinksState> & {
  getLinksForTab: (tabId: number, authorId: string) => GeneratedLinks | null;
  saveLinksForTab: (tabId: number, authorId: string, links: GeneratedLinks) => Promise<void>;
  clearLinksForTab: (tabId: number) => Promise<void>;
  clearAllLinks: () => Promise<void>;
};

// Create storage with default empty cache
const storage = createStorage<LinksState>('links-storage', {
  tabLinks: {},
}, {
  storageType: StorageType.Local,
  liveUpdate: true,
});

// Maximum age of cached links in milliseconds (24 hours)
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;

// Maximum number of tabs to keep in cache
const MAX_TABS_IN_CACHE = 20;

const linksStorage: LinksStorage = {
  ...storage,
  
  getLinksForTab: (tabId: number, authorId: string) => {
    const state = storage.getSnapshot();
    if (!state) return null;
    
    const tabLinks = state.tabLinks[tabId];
    if (!tabLinks) return null;
    
    const links = tabLinks[authorId];
    if (!links) return null;
    
    // Check if links are still valid (not expired)
    const now = Date.now();
    if (now - links.timestamp > MAX_CACHE_AGE) {
      // Links are expired, return null
      return null;
    }
    
    return links;
  },
  
  saveLinksForTab: async (tabId: number, authorId: string, links: GeneratedLinks) => {
    await storage.set(state => {
      const newState = { ...state };
      
      // Initialize tab entry if it doesn't exist
      if (!newState.tabLinks[tabId]) {
        newState.tabLinks[tabId] = {};
      }
      
      // Save links for this tab and author
      newState.tabLinks[tabId][authorId] = {
        ...links,
        timestamp: Date.now()
      };
      
      // Limit the number of tabs in cache
      const tabIds = Object.keys(newState.tabLinks).map(Number);
      if (tabIds.length > MAX_TABS_IN_CACHE) {
        // Sort tabs by most recent link timestamp
        tabIds.sort((a, b) => {
          const aLatest = Object.values(newState.tabLinks[a])
            .reduce((latest, link) => Math.max(latest, link.timestamp), 0);
          const bLatest = Object.values(newState.tabLinks[b])
            .reduce((latest, link) => Math.max(latest, link.timestamp), 0);
          return bLatest - aLatest; // Descending order
        });
        
        // Remove oldest tabs
        const tabsToRemove = tabIds.slice(MAX_TABS_IN_CACHE);
        tabsToRemove.forEach(id => {
          delete newState.tabLinks[id];
        });
      }
      
      return newState;
    });
  },
  
  clearLinksForTab: async (tabId: number) => {
    await storage.set(state => {
      const newState = { ...state };
      delete newState.tabLinks[tabId];
      return newState;
    });
  },
  
  clearAllLinks: async () => {
    await storage.set(state => ({
      ...state,
      tabLinks: {}
    }));
  }
};

export default linksStorage; 