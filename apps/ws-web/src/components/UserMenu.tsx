import { Show, createSignal } from "solid-js";
import { useAuth } from "../stores/auth";

export function UserMenu() {
  const { session, loading, signOut, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="w-8 h-8 rounded-full bg-zinc-200 dark:bg-slate-700 animate-pulse" />
      }
    >
      <Show
        when={isAuthenticated()}
        fallback={
          <a
            href="/auth/login"
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Sign In
          </a>
        }
      >
        <div class="relative">
          <button
            onClick={() => setIsOpen(!isOpen())}
            class="flex items-center gap-2 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
              {session()?.user?.name?.[0]?.toUpperCase() || session()?.user?.email?.[0]?.toUpperCase() || "?"}
            </div>
          </button>

          <Show when={isOpen()}>
            <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-zinc-200 dark:border-slate-700 py-1 z-50">
              <div class="px-4 py-3 border-b border-zinc-200 dark:border-slate-700">
                <p class="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {session()?.user?.name || "User"}
                </p>
                <p class="text-xs text-zinc-500 dark:text-slate-400 truncate">
                  {session()?.user?.email}
                </p>
                <p class="text-xs text-indigo-600 dark:text-indigo-400 mt-1 capitalize">
                  {session()?.user?.role || "subscriber"}
                </p>
              </div>

              <div class="py-1">
                <button
                  onClick={() => {
                    signOut();
                    setIsOpen(false);
                  }}
                  class="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </Show>
  );
}
