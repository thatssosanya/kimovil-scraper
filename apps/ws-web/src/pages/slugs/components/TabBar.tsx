import { For, Show } from "solid-js";

export type TabId = "html" | "raw" | "ai" | "compare" | "prices";

interface Tab {
  id: TabId;
  label: string;
  icon: "html" | "code" | "sparkle" | "compare" | "prices";
  available: boolean; // data exists (shows colored dot)
  enabled?: boolean;  // tab is clickable (defaults to available if not set)
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const icons = {
  html: (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  code: (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  sparkle: (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  compare: (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  prices: (
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const colorConfig = {
  html: {
    active: "text-slate-200 border-slate-400",
    inactive: "text-slate-500 hover:text-slate-300 border-transparent hover:border-slate-600",
    dot: "bg-slate-400",
    dotInactive: "bg-slate-600",
  },
  code: {
    active: "text-cyan-400 border-cyan-400",
    inactive: "text-slate-500 hover:text-cyan-400 border-transparent hover:border-cyan-600/50",
    dot: "bg-cyan-400",
    dotInactive: "bg-slate-600",
  },
  sparkle: {
    active: "text-violet-400 border-violet-400",
    inactive: "text-slate-500 hover:text-violet-400 border-transparent hover:border-violet-600/50",
    dot: "bg-violet-400",
    dotInactive: "bg-slate-600",
  },
  compare: {
    active: "text-amber-400 border-amber-400",
    inactive: "text-slate-500 hover:text-amber-400 border-transparent hover:border-amber-600/50",
    dot: "bg-amber-400",
    dotInactive: "bg-slate-600",
  },
  prices: {
    active: "text-amber-400 border-amber-400",
    inactive: "text-slate-500 hover:text-amber-400 border-transparent hover:border-amber-600/50",
    dot: "bg-amber-400",
    dotInactive: "bg-slate-600",
  },
};

export function TabBar(props: TabBarProps) {
  return (
    <div class="flex items-center gap-1 border-b border-slate-700/50">
      <For each={props.tabs}>
        {(tab) => {
          const colors = colorConfig[tab.icon];
          const isActive = () => props.activeTab === tab.id;
          const isEnabled = () => tab.enabled ?? tab.available;

          return (
            <button
              onClick={() => isEnabled() && props.onTabChange(tab.id)}
              disabled={!isEnabled()}
              class={`
                relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                border-b-2 -mb-px transition-all duration-200 cursor-pointer
                ${isActive() ? colors.active : colors.inactive}
                ${!isEnabled() ? "opacity-30 cursor-not-allowed" : ""}
              `}
            >
              {icons[tab.icon]}
              <span class="hidden sm:inline">{tab.label}</span>

              {/* Status indicator dot */}
              <Show when={tab.id !== "compare"}>
                <span
                  class={`
                    w-1.5 h-1.5 rounded-full transition-colors duration-200
                    ${tab.available ? colors.dot : colors.dotInactive}
                  `}
                />
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
