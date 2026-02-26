import { useState, useEffect, useCallback } from 'react';

interface TabInfo {
  url: string;
  title: string;
  id: number | null;
}

export function useCurrentTab() {
  const [tabInfo, setTabInfo] = useState<TabInfo>({
    url: '',
    title: '',
    id: null
  });

  const updateTabInfo = useCallback((url: string, title: string, id: number | null) => {
    setTabInfo({ url, title, id });
  }, []);

  const refreshCurrentTab = useCallback(async () => {
    if (tabInfo.id) {
      await chrome.tabs.reload(tabInfo.id);
    }
  }, [tabInfo.id]);

  useEffect(() => {
    const fetchCurrentTab = async () => {
      const queryOptions = { active: true, lastFocusedWindow: true };
      const [tab] = await chrome.tabs.query(queryOptions);
      
      if (tab) {
        updateTabInfo(tab.url || '', tab.title || '', tab.id || null);
      }
    };

    fetchCurrentTab();

    const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active) {
        if (changeInfo.url || changeInfo.title) {
          updateTabInfo(
            tab.url || '', 
            changeInfo.title || tab.title || '', 
            tab.id || null
          );
        }
      }
    };

    const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      updateTabInfo(tab.url || '', tab.title || '', tab.id || null);
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [updateTabInfo]);

  return { ...tabInfo, refreshCurrentTab };
}