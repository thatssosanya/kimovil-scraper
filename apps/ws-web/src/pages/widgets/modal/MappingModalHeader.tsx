import { useMappingModal } from "./MappingModalContext";
import { StatusBadge } from "../components/StatusBadge";

export function MappingModalHeader() {
  const ctx = useMappingModal();

  return (
    <div class="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-800 px-6 py-4">
      <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
        <div class="flex items-center gap-4 min-w-0 flex-1">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-white truncate font-mono">
              {ctx.mapping()!.rawModel}
            </h2>
            <div class="flex items-center gap-3 mt-1">
              <StatusBadge status={ctx.mapping()!.status} />
              <span class="text-xs text-zinc-500 dark:text-slate-400">
                {ctx.mapping()!.usageCount} uses
              </span>
              <span class="text-xs text-zinc-500 dark:text-slate-400">
                {ctx.formatDate(ctx.mapping()!.firstSeenAt)} —{" "}
                {ctx.formatDate(ctx.mapping()!.lastSeenAt)}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-xs text-zinc-400 dark:text-slate-500 hidden sm:inline">
            Esc to close · Enter to confirm · I to ignore
          </span>
          <button
            onClick={ctx.closeModal}
            class="p-2 hover:bg-zinc-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-zinc-500"
          >
            <svg
              class="w-5 h-5"
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
      </div>
    </div>
  );
}
