import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ru" className="scrollbar h-full">
      <Head>
        {/* Inline script for immediate theme application - prevents FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Get system preference
                  var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  
                  // Priority: localStorage -> system -> light
                  var localTheme = localStorage.getItem('theme');
                  var shouldBeDark = false;
                  
                  if (localTheme === 'dark') {
                    shouldBeDark = true;
                  } else if (localTheme === 'light') {
                    shouldBeDark = false;
                  } else if (localTheme === 'system' || !localTheme) {
                    shouldBeDark = systemPrefersDark;
                  }
                  
                  // Apply theme
                  if (shouldBeDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  
                  // Set data-theme attribute for cross-domain sync
                  document.documentElement.setAttribute('data-theme', shouldBeDark ? 'dark' : 'light');
                } catch (e) {}
              })();
            `,
          }}
        />
      </Head>
      <body className="scrollbar h-full overflow-auto">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
