import { Show, For } from "solid-js";

interface ErrorItem {
  slug: string;
  error: string | null;
  errorCode: string | null;
  attempt: number;
  updatedAt: number;
}

interface ErrorItemsModalProps {
  jobId: string | null;
  items: ErrorItem[];
  loading: boolean;
  onClose: () => void;
  onRetry: (jobId: string) => void;
}

export function ErrorItemsModal(props: ErrorItemsModalProps) {
  const getErrorCodeBadge = (code: string | null) => {
    const colors: Record<string, string> = {
      bot: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      invalid_html: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      timeout: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      network: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      unknown: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    };
    return colors[code || "unknown"] || colors.unknown;
  };

  return (
    <Show when={props.jobId}>
      <div
        class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={props.onClose}
      >
        <div
          class="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between p-4 border-b border-slate-800">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-rose-500/10 rounded-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-rose-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-white">Failed Items</h3>
                <p class="text-xs text-slate-400">
                  Job {props.jobId?.slice(0, 8)} - {props.items.length} errors
                </p>
              </div>
            </div>
            <button
              class="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
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

          {/* Content */}
          <div class="flex-1 overflow-auto p-4">
            <Show when={props.loading}>
              <div class="flex items-center justify-center py-12">
                <div class="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            </Show>

            <Show when={!props.loading && props.items.length === 0}>
              <div class="text-center py-12 text-slate-500">
                No failed items found
              </div>
            </Show>

            <Show when={!props.loading && props.items.length > 0}>
              <div class="space-y-2">
                <For each={props.items}>
                  {(item) => (
                    <div class="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 hover:bg-slate-800 transition-colors">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                            <span class="font-mono text-sm text-slate-200 truncate">
                              {item.slug}
                            </span>
                            <Show when={item.errorCode}>
                              <span
                                class={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border ${getErrorCodeBadge(item.errorCode)}`}
                              >
                                {item.errorCode}
                              </span>
                            </Show>
                          </div>
                          <p class="text-xs text-slate-400 line-clamp-2">
                            {item.error || "Unknown error"}
                          </p>
                        </div>
                        <div class="text-right text-[10px] text-slate-500 whitespace-nowrap">
                          <div>Attempt {item.attempt}</div>
                          <div>
                            {new Date(item.updatedAt * 1000).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/50">
            <div class="text-xs text-slate-500">
              Showing up to 200 most recent failures
            </div>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                onClick={props.onClose}
              >
                Close
              </button>
              <Show when={props.items.length > 0}>
                <button
                  class="px-4 py-2 text-sm font-medium bg-rose-500 hover:bg-rose-400 text-white rounded-lg transition-colors"
                  onClick={() => props.onRetry(props.jobId!)}
                >
                  Retry All Failed
                </button>
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
