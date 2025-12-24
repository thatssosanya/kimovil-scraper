import { Show } from "solid-js";

interface HtmlPreviewModalProps {
  slug: string | null;
  html: string | null;
  loading: boolean;
  onClose: () => void;
}

export function HtmlPreviewModal(props: HtmlPreviewModalProps) {
  return (
    <Show when={props.slug}>
      <div
        class="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        <div class="bg-white dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/50 rounded-t-2xl">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="text-zinc-500 dark:text-slate-400">Raw HTML:</span>
              <span class="font-mono text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 dark:bg-cyan-900/20 px-2 py-0.5 rounded border border-cyan-500/20">
                {props.slug}
              </span>
            </h2>
            <button
              class="cursor-pointer text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-slate-800 hover:bg-zinc-200 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors"
              onClick={props.onClose}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-auto p-0">
            <Show when={props.loading}>
              <div class="flex items-center justify-center py-24">
                <div class="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </Show>
            <Show when={!props.loading && props.html}>
              <iframe
                srcdoc={props.html!}
                class="w-full h-full min-h-[70vh] bg-white"
                sandbox="allow-same-origin"
              />
            </Show>
            <Show when={!props.loading && !props.html}>
              <div class="text-center text-zinc-500 dark:text-slate-500 py-24 flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-12 w-12 mb-4 opacity-50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p>No HTML data found for this slug.</p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
