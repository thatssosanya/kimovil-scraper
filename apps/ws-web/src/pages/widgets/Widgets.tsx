import { createSignal, createEffect, Show, For, onCleanup, type Accessor } from "solid-js";
import { Header } from "../../components/Header";
import { api } from "../../api/client";

type ArrowVariant = "neutral" | "up" | "down" | "hot" | "new";

interface DeviceOption {
  slug: string;
  name: string;
  brand: string | null;
}

interface WidgetConfigProps {
  arrowVariant: Accessor<ArrowVariant>;
  setArrowVariant: (v: ArrowVariant) => void;
  slug: Accessor<string>;
  setSlug: (s: string) => void;
}

function WidgetConfig(props: WidgetConfigProps) {
  const [searchQuery, setSearchQuery] = createSignal(props.slug());
  const [suggestions, setSuggestions] = createSignal<DeviceOption[]>([]);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  let debounceTimer: number | undefined;

  const searchDevices = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const res = await api(`/api/v2/devices?search=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.devices.map((d: any) => ({
          slug: d.slug,
          name: d.name,
          brand: d.brand,
        })));
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchDevices(value), 200) as unknown as number;
  };

  const selectDevice = (device: DeviceOption) => {
    setSearchQuery(device.slug);
    props.setSlug(device.slug);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const variants: { id: ArrowVariant; label: string; color?: string }[] = [
    { id: "neutral", label: "—" },
    { id: "up", label: "↑", color: "hsl(354,100%,64%)" },
    { id: "down", label: "↓", color: "hsl(158,64%,42%)" },
    { id: "hot", label: "🔥", color: "hsl(25,95%,53%)" },
    { id: "new", label: "★", color: "hsl(45,93%,47%)" },
  ];

  return (
    <div class="mb-6 p-4 bg-white rounded-xl border border-neutral-200/60 space-y-4">
      {/* Device search */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Device</div>
        <div class="relative">
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => handleInput(e.currentTarget.value)}
            onFocus={() => searchQuery().length >= 2 && setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery()) {
                props.setSlug(searchQuery());
                setShowSuggestions(false);
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Search device..."
            class="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
          <Show when={loading()}>
            <div class="absolute right-3 top-1/2 -translate-y-1/2">
              <div class="w-4 h-4 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
            </div>
          </Show>
          
          {/* Suggestions dropdown */}
          <Show when={showSuggestions() && suggestions().length > 0}>
            <div class="absolute z-50 w-full mt-1 bg-white rounded-lg border border-neutral-200 shadow-lg max-h-64 overflow-y-auto">
              <For each={suggestions()}>
                {(device) => (
                  <button
                    type="button"
                    onClick={() => selectDevice(device)}
                    class="w-full px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors flex items-center gap-2 border-b border-neutral-100 last:border-0"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-neutral-900 truncate">
                        {device.brand ? `${device.brand} ` : ""}{device.name}
                      </div>
                      <div class="text-xs text-neutral-400 truncate">{device.slug}</div>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Price indicator style */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Price Indicator</div>
        <div class="flex gap-2">
          <For each={variants}>
            {(variant) => (
              <button
                onClick={() => props.setArrowVariant(variant.id)}
                class={`w-10 h-10 flex items-center justify-center text-lg font-medium rounded-lg transition-all ${
                  props.arrowVariant() === variant.id
                    ? "ring-2 ring-neutral-900 ring-offset-2"
                    : "hover:bg-neutral-100"
                }`}
                style={{
                  background: props.arrowVariant() === variant.id && variant.color 
                    ? `${variant.color}15` 
                    : undefined,
                  color: variant.color || "inherit",
                }}
              >
                {variant.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

export default function Widgets() {
  const [slug, setSlug] = createSignal("samsung-galaxy-a16-4g");
  const [arrowVariant, setArrowVariant] = createSignal<ArrowVariant>("neutral");
  const [html, setHtml] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const currentSlug = slug();
    const currentVariant = arrowVariant();
    
    setLoading(true);
    setError(null);
    
    api(`/widget/v1/price/${encodeURIComponent(currentSlug)}?arrowVariant=${currentVariant}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setHtml(text);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load widget");
      })
      .finally(() => {
        setLoading(false);
      });
  });

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widgets" />
      <div class="flex items-center justify-center py-16 px-4">
        <div class="w-full max-w-[680px]">
          <WidgetConfig 
            arrowVariant={arrowVariant} 
            setArrowVariant={setArrowVariant}
            slug={slug}
            setSlug={setSlug}
          />
          
          <Show when={loading()}>
            <div class="bg-white rounded-2xl border border-neutral-200/60 p-12 flex items-center justify-center">
              <div class="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          </Show>
          
          <Show when={error()}>
            <div class="bg-red-50 rounded-2xl border border-red-200/60 p-6 text-center text-red-500 text-sm">
              {error()}
            </div>
          </Show>
          
          <Show when={!loading() && !error() && html()}>
            <div innerHTML={html()!} />
          </Show>
        </div>
      </div>
    </div>
  );
}
