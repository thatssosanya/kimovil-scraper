import fs from 'node:fs';
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  /**
   * if you want to support multiple languages, you can use the following reference
   * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
   */
  name: '__MSG_extensionName__',
  version: packageJson.version,
  description: '__MSG_extensionDescription__',
  permissions: ['storage', 'sidePanel', 'tabs', 'activeTab'],
  host_permissions: [
    'https://kik.cat/*',
    'https://c.click-or-die.ru/*',
    'http://localhost:1488/*',
    'https://api.click-or-die.ru/*'
  ],
  side_panel: {
    default_path: 'src/pages/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/pages/background/index.js',
    type: 'module',
  },
  action: {
    default_icon: 'icon-34.png',
  },
  icons: {
    128: 'icon-128.png',
  },
};

export default manifest;
