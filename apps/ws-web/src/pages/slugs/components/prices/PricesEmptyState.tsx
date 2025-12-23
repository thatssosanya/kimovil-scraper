import { createSignal, Show } from "solid-js";

interface PricesEmptyStateProps {
  onLink: (url: string) => Promise<void>;
  linking: boolean;
  progress: number;
}

export function PricesEmptyState(props: PricesEmptyStateProps) {
  const [url, setUrl] = createSignal("");
  const [focused, setFocused] = createSignal(false);
  
  const handleSubmit = async () => {
    if (!url().trim() || props.linking) return;
    await props.onLink(url());
  };
  
  const isValidUrl = () => {
    const u = url().trim();
    return u.startsWith("https://market.yandex.ru/") || u.startsWith("http://market.yandex.ru/");
  };
  
  return (
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-lg text-center">
        {/* Decorative icon */}
        <div class="relative mx-auto w-24 h-24 mb-8">
          {/* Outer ring */}
          <div class="absolute inset-0 rounded-full border-2 border-dashed border-slate-700 animate-[spin_20s_linear_infinite]" />
          
          {/* Inner glow */}
          <div class="absolute inset-2 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/5" />
          
          {/* Icon container */}
          <div class="absolute inset-4 rounded-full bg-slate-800/80 backdrop-blur flex items-center justify-center">
            <svg class="w-10 h-10 text-amber-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          {/* Floating particles */}
          <div class="absolute -top-1 right-2 w-2 h-2 rounded-full bg-amber-400/30 animate-pulse" />
          <div class="absolute bottom-0 -left-1 w-1.5 h-1.5 rounded-full bg-amber-500/20 animate-pulse animation-delay-500" />
          <div class="absolute top-4 -right-2 w-1 h-1 rounded-full bg-orange-400/40 animate-pulse animation-delay-300" />
        </div>
        
        {/* Heading */}
        <h2 class="text-2xl font-light text-white mb-2 tracking-tight">
          Track Prices
        </h2>
        <p class="text-slate-400 mb-8 leading-relaxed">
          Connect a Yandex.Market listing to monitor prices<br />
          and get notified when deals appear
        </p>
        
        {/* Input form */}
        <div class="relative">
          {/* Input wrapper with glow effect */}
          <div class={`
            relative rounded-2xl transition-all duration-300
            ${focused() ? "ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10" : ""}
          `}>
            {/* Gradient border */}
            <div class={`
              absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/50 via-orange-500/50 to-amber-500/50 p-px transition-opacity duration-300
              ${focused() ? "opacity-100" : "opacity-0"}
            `}>
              <div class="w-full h-full rounded-2xl bg-slate-900" />
            </div>
            
            <div class="relative flex items-center bg-slate-800/80 border border-slate-700/50 rounded-2xl overflow-hidden">
              {/* Icon */}
              <div class="pl-5 pr-3">
                <svg class={`
                  w-5 h-5 transition-colors duration-200
                  ${focused() ? "text-amber-400" : "text-slate-500"}
                `} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              
              {/* Input */}
              <input
                type="url"
                placeholder="https://market.yandex.ru/product/..."
                value={url()}
                onInput={(e) => setUrl(e.currentTarget.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                disabled={props.linking}
                class="flex-1 py-4 pr-4 bg-transparent text-white placeholder:text-slate-500 outline-none text-sm disabled:opacity-50"
              />
              
              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!url().trim() || props.linking}
                class="m-2 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-semibold text-sm hover:from-amber-300 hover:to-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30"
              >
                <Show when={props.linking}>
                  <div class="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span>{props.progress > 0 ? `${props.progress}%` : "Linking..."}</span>
                </Show>
                <Show when={!props.linking}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Connect</span>
                </Show>
              </button>
            </div>
          </div>
          
          {/* Validation hint */}
          <Show when={url().length > 0 && !isValidUrl()}>
            <div class="mt-3 flex items-center justify-center gap-2 text-xs text-amber-500/70">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>Please enter a valid Yandex.Market URL</span>
            </div>
          </Show>
        </div>
        
        {/* Features list */}
        <div class="mt-12 grid grid-cols-3 gap-6">
          <div class="text-center">
            <div class="w-10 h-10 mx-auto rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div class="text-sm text-slate-400">Price tracking</div>
          </div>
          <div class="text-center">
            <div class="w-10 h-10 mx-auto rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div class="text-sm text-slate-400">Compare sellers</div>
          </div>
          <div class="text-center">
            <div class="w-10 h-10 mx-auto rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div class="text-sm text-slate-400">Alerts</div>
          </div>
        </div>
      </div>
    </div>
  );
}
