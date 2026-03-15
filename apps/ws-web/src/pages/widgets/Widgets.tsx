import {
  createSignal,
  createEffect,
  Show,
  For,
  onCleanup,
  type Accessor,
} from "solid-js";
import { Header } from "../../components/Header";
import { api } from "../../api/client";

type ArrowVariant = "neutral" | "up" | "down" | "hot" | "new";
type WidgetTab = "price" | "deals";
type DealsSortOrder = "newest" | "cheapest" | "hottest";
type DealsLayout = "vertical" | "horizontal";

const isAbortError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

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
      const res = await api(
        `/api/v2/devices?search=${encodeURIComponent(query)}&limit=8`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(
          data.devices.map((d: any) => ({
            slug: d.slug,
            name: d.name,
            brand: d.brand,
          })),
        );
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
    debounceTimer = setTimeout(
      () => searchDevices(value),
      200,
    ) as unknown as number;
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
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Device
        </div>
        <div class="relative">
          <input
            type="text"
            value={searchQuery()}
            onInput={(e) => handleInput(e.currentTarget.value)}
            onFocus={() =>
              searchQuery().length >= 2 && setShowSuggestions(true)
            }
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
                        {device.brand ? `${device.brand} ` : ""}
                        {device.name}
                      </div>
                      <div class="text-xs text-neutral-400 truncate">
                        {device.slug}
                      </div>
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
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Price Indicator
        </div>
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
                  background:
                    props.arrowVariant() === variant.id && variant.color
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

interface DealsConfigProps {
  limit: Accessor<number>;
  setLimit: (v: number) => void;
  sort: Accessor<DealsSortOrder>;
  setSort: (v: DealsSortOrder) => void;
  minBonus: Accessor<number>;
  setMinBonus: (v: number) => void;
  layout: Accessor<DealsLayout>;
  setLayout: (v: DealsLayout) => void;
}

function DealsConfig(props: DealsConfigProps) {
  const sortOptions: { id: DealsSortOrder; label: string }[] = [
    { id: "newest", label: "Новые" },
    { id: "cheapest", label: "Дешёвые" },
    { id: "hottest", label: "Макс. бонус" },
  ];

  const limitOptions = [3, 6, 9, 12];

  const layoutOptions: { id: DealsLayout; label: string }[] = [
    { id: "vertical", label: "List" },
    { id: "horizontal", label: "Shelf" },
  ];

  return (
    <div class="mb-6 p-4 bg-white rounded-xl border border-neutral-200/60 space-y-4">
      {/* Layout */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Layout
        </div>
        <div class="flex gap-2">
          <For each={layoutOptions}>
            {(opt) => (
              <button
                onClick={() => props.setLayout(opt.id)}
                class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  props.layout() === opt.id
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Sort */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Sort
        </div>
        <div class="flex gap-2">
          <For each={sortOptions}>
            {(opt) => (
              <button
                onClick={() => props.setSort(opt.id)}
                class={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  props.sort() === opt.id
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Limit */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Limit
        </div>
        <div class="flex gap-2">
          <For each={limitOptions}>
            {(n) => (
              <button
                onClick={() => props.setLimit(n)}
                class={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all ${
                  props.limit() === n
                    ? "ring-2 ring-neutral-900 ring-offset-2 bg-neutral-50"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {n}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Min bonus */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Min Bonus (rubles, 0 = all)
        </div>
        <input
          type="number"
          value={props.minBonus()}
          onInput={(e) =>
            props.setMinBonus(parseInt(e.currentTarget.value || "0", 10))
          }
          placeholder="0"
          class="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
    </div>
  );
}

function WidgetPreview(props: {
  html: string | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <>
      <Show when={props.loading}>
        <div class="bg-white rounded-2xl border border-neutral-200/60 p-12 flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={props.error}>
        <div class="bg-red-50 rounded-2xl border border-red-200/60 p-6 text-center text-red-500 text-sm">
          {props.error}
        </div>
      </Show>

      <Show when={!props.loading && !props.error && props.html}>
        <div innerHTML={props.html!} />
      </Show>
    </>
  );
}

export default function Widgets() {
  const [tab, setTab] = createSignal<WidgetTab>("price");

  // Price widget state
  const [slug, setSlug] = createSignal("samsung-galaxy-a16-4g");
  const [arrowVariant, setArrowVariant] = createSignal<ArrowVariant>("neutral");
  const [priceHtml, setPriceHtml] = createSignal<string | null>(null);
  const [priceLoading, setPriceLoading] = createSignal(false);
  const [priceError, setPriceError] = createSignal<string | null>(null);

  // Deals widget state
  const [dealsLimit, setDealsLimit] = createSignal(6);
  const [dealsSort, setDealsSort] = createSignal<DealsSortOrder>("newest");
  const [dealsMinBonus, setDealsMinBonus] = createSignal(0);
  const [dealsLayout, setDealsLayout] = createSignal<DealsLayout>("vertical");
  const [dealsHtml, setDealsHtml] = createSignal<string | null>(null);
  const [dealsLoading, setDealsLoading] = createSignal(false);
  const [dealsError, setDealsError] = createSignal<string | null>(null);

  // Fetch price widget
  createEffect(() => {
    if (tab() !== "price") return;
    const currentSlug = slug();
    const currentVariant = arrowVariant();
    const controller = new AbortController();
    let isCurrent = true;

    onCleanup(() => {
      isCurrent = false;
      controller.abort();
    });

    setPriceLoading(true);
    setPriceError(null);

    api(
      `/widget/v1/price/${encodeURIComponent(currentSlug)}?arrowVariant=${currentVariant}`,
      {
        signal: controller.signal,
      },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!isCurrent) return;
        setPriceHtml(text);
      })
      .catch((e) => {
        if (!isCurrent || isAbortError(e)) return;
        setPriceError(e instanceof Error ? e.message : "Failed to load widget");
      })
      .finally(() => {
        if (!isCurrent) return;
        setPriceLoading(false);
      });
  });

  // Fetch deals widget
  createEffect(() => {
    if (tab() !== "deals") return;
    const limit = dealsLimit();
    const sort = dealsSort();
    const minBonus = dealsMinBonus();
    const layout = dealsLayout();
    const controller = new AbortController();
    let isCurrent = true;

    onCleanup(() => {
      isCurrent = false;
      controller.abort();
    });

    setDealsLoading(true);
    setDealsError(null);

    const params = new URLSearchParams({
      limit: String(limit),
      sort,
      minBonus: String(minBonus),
      layout,
    });

    api(`/widget/v1/deals?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!isCurrent) return;
        setDealsHtml(text);
      })
      .catch((e) => {
        if (!isCurrent || isAbortError(e)) return;
        setDealsError(e instanceof Error ? e.message : "Failed to load widget");
      })
      .finally(() => {
        if (!isCurrent) return;
        setDealsLoading(false);
      });
  });

  const tabs: { id: WidgetTab; label: string }[] = [
    { id: "price", label: "Price Widget" },
    { id: "deals", label: "Deals Widget" },
  ];

  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widgets" />
      <div class="flex items-center justify-center py-16 px-4">
        <div class="w-full max-w-[680px]">
          {/* Tab switcher */}
          <div class="mb-6 flex gap-1 p-1 bg-neutral-200/60 rounded-lg">
            <For each={tabs}>
              {(t) => (
                <button
                  onClick={() => setTab(t.id)}
                  class={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    tab() === t.id
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {t.label}
                </button>
              )}
            </For>
          </div>

          {/* Price widget tab */}
          <Show when={tab() === "price"}>
            <WidgetConfig
              arrowVariant={arrowVariant}
              setArrowVariant={setArrowVariant}
              slug={slug}
              setSlug={setSlug}
            />
            <WidgetPreview
              html={priceHtml()}
              loading={priceLoading()}
              error={priceError()}
            />
          </Show>

          {/* Deals widget tab */}
          <Show when={tab() === "deals"}>
            <DealsConfig
              limit={dealsLimit}
              setLimit={setDealsLimit}
              sort={dealsSort}
              setSort={setDealsSort}
              minBonus={dealsMinBonus}
              setMinBonus={setDealsMinBonus}
              layout={dealsLayout}
              setLayout={setDealsLayout}
            />
            <WidgetPreview
              html={dealsHtml()}
              loading={dealsLoading()}
              error={dealsError()}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}
