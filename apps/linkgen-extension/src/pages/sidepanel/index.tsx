import React from 'react';
import { createRoot } from 'react-dom/client';
import '@pages/sidepanel/index.css';
import refreshOnUpdate from 'virtual:reload-on-update-in-view';
import SidePanel from '@pages/sidepanel/SidePanel';
import { attachTwindStyle } from '@root/src/shared/style/twind';

refreshOnUpdate('pages/sidepanel');

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  attachTwindStyle(appContainer, document);
  const root = createRoot(appContainer);
  root.render(<SidePanel />);
}

init();
