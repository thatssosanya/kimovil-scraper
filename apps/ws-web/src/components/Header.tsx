import { Show, createSignal } from "solid-js";
import { theme, toggleTheme } from "../stores/theme";

interface HeaderProps {
  currentPage: "scraper" | "database" | "widgets";
  status?: string;
  onHealthCheck?: () => void;
}

function Logo() {
  return (
    <svg
      viewBox="0 0 40 40"
      class="w-9 h-9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="50%" stop-color="#8b5cf6" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M20 5L33 12.5V27.5L20 35L7 27.5V12.5L20 5Z"
        stroke="url(#logoGradient)"
        stroke-width="2.5"
        stroke-linejoin="round"
        fill="none"
      />
      <path
        d="M20 12L28 16.5V23.5L20 28L12 23.5V16.5L20 12Z"
        fill="url(#logoGradient)"
        fill-opacity="0.2"
        stroke="url(#logoGradient)"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ThemeToggle() {
  return (
    <button
      onClick={toggleTheme}
      class="p-2 rounded-lg transition-colors cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-slate-300"
      title={theme() === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Show when={theme() === "dark"}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </Show>
      <Show when={theme() === "light"}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </Show>
    </button>
  );
}

export function Header(props: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  const navItems = [
    { id: "scraper", label: "Scraper", href: "/", icon: "search" },
    { id: "database", label: "Database", href: "/slugs", icon: "database" },
    { id: "widgets", label: "Widgets", href: "/widgets", icon: "widgets" },
  ];

  return (
    <header class="relative z-50">
      {/* Glass background */}
      <div class="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5" />

      <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div class="flex-shrink-0 flex items-center gap-3">
            <a href="/" class="flex items-center gap-3 group">
              <Logo />
              <span class="text-lg font-bold tracking-tight text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                P-Scraper
              </span>
            </a>
          </div>

          {/* Center: Desktop Navigation */}
          <nav class="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = props.currentPage === item.id;
              return (
                <a
                  href={item.href}
                  class={`
                    px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? "text-zinc-900 dark:text-white bg-zinc-200 dark:bg-white/10" 
                      : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                    }
                  `}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Right: Status + Actions */}
          <div class="flex items-center gap-3">
            {/* Connection Status */}
            <Show when={props.status !== undefined}>
              <div
                class={`
                  hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border
                  ${props.status === "Connected"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                  }
                `}
              >
                <span class={`h-1.5 w-1.5 rounded-full ${props.status === "Connected" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-500 dark:bg-rose-400"}`} />
                {props.status}
              </div>
            </Show>

            {/* Health Check Button */}
            <Show when={props.onHealthCheck}>
              <button
                class="
                  hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                  bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-slate-300 hover:text-zinc-900 dark:hover:text-white
                  border border-zinc-200 dark:border-white/10 transition-colors cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                onClick={props.onHealthCheck}
                disabled={props.status !== "Connected"}
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Health
              </button>
            </Show>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Mobile menu button */}
            <button 
              class="md:hidden p-2 rounded-md text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen())}
            >
              <Show when={!isMenuOpen()} fallback={
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              }>
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Show>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <Show when={isMenuOpen()}>
        <div class="md:hidden absolute top-16 left-0 right-0 bg-white dark:bg-slate-900 border-b border-zinc-200 dark:border-white/10 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div class="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const isActive = props.currentPage === item.id;
              return (
                <a
                  href={item.href}
                  class={`
                    block px-3 py-2 rounded-md text-base font-medium
                    ${isActive 
                      ? "bg-indigo-500/20 text-zinc-900 dark:text-white" 
                      : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
                    }
                  `}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div class="flex items-center gap-3">
                    <Show when={item.icon === "search"}>
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </Show>
                    <Show when={item.icon === "database"}>
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </Show>
                    {item.label}
                  </div>
                </a>
              );
            })}
            
            {/* Mobile Status & Actions */}
            <div class="pt-4 pb-2 border-t border-zinc-200 dark:border-white/10 mt-2">
              <div class="px-3 flex items-center justify-between">
                <Show when={props.status !== undefined}>
                  <div class="flex items-center gap-2 text-sm text-zinc-600 dark:text-slate-400">
                    <span class={`h-2 w-2 rounded-full ${props.status === "Connected" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-rose-500 dark:bg-rose-400"}`} />
                    {props.status}
                  </div>
                </Show>
                
                <Show when={props.onHealthCheck}>
                  <button
                    class="
                      flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                      bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-slate-300 border border-zinc-200 dark:border-white/10
                    "
                    onClick={() => {
                      props.onHealthCheck?.();
                      setIsMenuOpen(false);
                    }}
                    disabled={props.status !== "Connected"}
                  >
                    Health Check
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </header>
  );
}
