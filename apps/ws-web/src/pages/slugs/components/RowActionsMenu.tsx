import { createSignal, Show } from "solid-js";

interface RowActionsMenuProps {
  slug: string;
  hasAnyData: boolean;
  hasRawData: boolean;
  hasAiData: boolean;
  onClearAll: () => void;
  onClearRaw: () => void;
  onClearAi: () => void;
}

export function RowActionsMenu(props: RowActionsMenuProps) {
  const [open, setOpen] = createSignal(false);

  const handleAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <Show when={props.hasAnyData}>
      <div class="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open());
          }}
          class="p-1.5 rounded-md text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
          title="More actions"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>

        <Show when={open()}>
          <div
            class="absolute right-0 top-full mt-1 z-50 min-w-[140px] bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <Show when={props.hasRawData}>
              <button
                onClick={() => handleAction(props.onClearRaw)}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-500/10 cursor-pointer transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Clear Raw
              </button>
            </Show>

            <Show when={props.hasAiData}>
              <button
                onClick={() => handleAction(props.onClearAi)}
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/10 cursor-pointer transition-colors"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Clear AI
              </button>
            </Show>

            <div class="h-px bg-zinc-200 dark:bg-slate-700 my-1" />

            <button
              onClick={() => handleAction(props.onClearAll)}
              class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Clear All
            </button>
          </div>
        </Show>

        <Show when={open()}>
          <div
            class="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
        </Show>
      </div>
    </Show>
  );
}
