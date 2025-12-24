import { createSignal, createEffect, Show, For, type Accessor, onCleanup } from "solid-js";

interface PriceOffer {
  seller: string;
  price: number;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable?: boolean;
  externalId?: string;
  scrapedAt: number;
  source?: string;
}

interface ShopGroup {
  id: string;
  name: string;
  logo?: string;
  offers: PriceOffer[];
  minPrice: number;
}

const SHOP_CONFIG: Record<string, { name: string; logo?: string }> = {
  yandex_market: { name: "Яндекс Маркет" },
  price_ru: { name: "Price.ru" },
};

interface PhoneDataRaw {
  name: string;
  brand: string;
  images: string[] | null;
  cpu: string | null;
  batteryCapacity_mah: number | null;
  size_in: number | null;
}

type ArrowVariant = "neutral" | "up" | "down" | "hot" | "new";

interface PalachPriceWidgetProps {
  slug: string;
  arrowVariant?: ArrowVariant;
}

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
  priceRuMin: Accessor<number>;
  setPriceRuMin: (v: number) => void;
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
      const res = await fetch(`http://localhost:1488/api/slugs?search=${encodeURIComponent(query)}&limit=8`);
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

      {/* Price.ru config */}
      <div>
        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Price.ru Min Price (₽)</div>
        <input
          type="number"
          value={props.priceRuMin() / 100}
          onInput={(e) => props.setPriceRuMin(parseInt(e.currentTarget.value || "0") * 100)}
          placeholder="e.g. 12990"
          class="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
        />
      </div>
    </div>
  );
}

export function PalachPriceWidget(props: PalachPriceWidgetProps) {
  const [phoneData, setPhoneData] = createSignal<PhoneDataRaw | null>(null);
  const [quotes, setQuotes] = createSignal<PriceOffer[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [arrowVariant, setArrowVariant] = createSignal<ArrowVariant>(props.arrowVariant || "neutral");
  const [currentSlug, setCurrentSlug] = createSignal(props.slug);
  const [priceRuMin, setPriceRuMin] = createSignal(1299000); // 12990 rubles in minor units

  createEffect(async () => {
    const slug = currentSlug();
    if (!slug) return;

    setLoading(true);
    setError(null);

    try {
      const [phoneRes, quotesRes] = await Promise.all([
        fetch(`http://localhost:1488/api/phone-data/raw/${encodeURIComponent(slug)}`),
        fetch(`http://localhost:1488/api/prices/${encodeURIComponent(slug)}/quotes?limit=10`),
      ]);

      if (phoneRes.ok) {
        const phoneJson = await phoneRes.json();
        setPhoneData(phoneJson.data);
      }

      if (quotesRes.ok) {
        const quotesJson = await quotesRes.json();
        setQuotes(quotesJson);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  });

  const formatPrice = (minorUnits: number) => {
    const rubles = Math.round(minorUnits / 100);
    return rubles.toLocaleString("ru-RU");
  };

  const availableQuotes = () => quotes().filter(q => q.isAvailable !== false);
  
  const minPrice = () => {
    const available = availableQuotes();
    if (available.length === 0) return null;
    return Math.min(...available.map(q => q.price));
  };

  const shopGroups = (): ShopGroup[] => {
    const available = availableQuotes();
    const groups = new Map<string, PriceOffer[]>();
    
    for (const offer of available) {
      const source = offer.source || "yandex_market";
      if (!groups.has(source)) {
        groups.set(source, []);
      }
      groups.get(source)!.push(offer);
    }

    // Add mock price.ru data for demo
    if (!groups.has("price_ru") && available.length > 0) {
      const basePrice = priceRuMin();
      const mockOffers: PriceOffer[] = [
        { ...available[0], seller: "TechnoPoint", price: basePrice, source: "price_ru" },
        { ...available[0], seller: "DNS", price: basePrice + 130000, source: "price_ru" },
      ];
      groups.set("price_ru", mockOffers);
    }

    return Array.from(groups.entries())
      .map(([id, offers]) => ({
        id,
        name: SHOP_CONFIG[id]?.name || id,
        offers: offers.sort((a, b) => a.price - b.price).slice(0, 3),
        minPrice: Math.min(...offers.map(o => o.price)),
      }))
      .sort((a, b) => a.minPrice - b.minPrice);
  };

  return (
    <div class="w-full max-w-[680px] font-['Inter',system-ui,-apple-system,sans-serif]">
      {/* Config panel */}
      <WidgetConfig 
        arrowVariant={arrowVariant} 
        setArrowVariant={setArrowVariant}
        slug={currentSlug}
        setSlug={setCurrentSlug}
        priceRuMin={priceRuMin}
        setPriceRuMin={setPriceRuMin}
      />
      
      {/* Widget container */}
      <div class="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
        
        <Show when={loading()}>
          <div class="p-12 flex items-center justify-center">
            <div class="w-6 h-6 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
          </div>
        </Show>

        <Show when={error()}>
          <div class="p-12 text-center text-neutral-500 text-sm">{error()}</div>
        </Show>

        <Show when={!loading() && !error()}>
          {/* Header */}
          <div class="p-6 pb-5">
            <div class="flex items-start gap-5">
              {/* Product image */}
              <div class="w-[100px] h-[120px] bg-neutral-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                <Show 
                  when={phoneData()?.images?.[0]} 
                  fallback={
                    <div class="w-14 h-20 bg-neutral-100 rounded-lg" />
                  }
                >
                  <img 
                    src={phoneData()!.images![0]} 
                    alt={phoneData()?.name || "Phone"} 
                    class="max-w-full max-h-full object-contain"
                  />
                </Show>
              </div>

              {/* Product info */}
              <div class="flex-1 min-w-0 pt-1">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1">
                    <h2 class="text-[22px] font-semibold text-neutral-900 leading-tight tracking-[-0.02em]">
                      {phoneData()?.brand} {phoneData()?.name || currentSlug()}
                    </h2>
                    
                    <Show when={availableQuotes().length > 0}>
                      <p class="mt-2 text-[15px] text-neutral-500">
                        {availableQuotes().length} предложени{availableQuotes().length === 1 ? "е" : availableQuotes().length < 5 ? "я" : "й"} от продавцов
                      </p>
                    </Show>
                  </div>

                  {/* Specs column */}
                  <Show when={phoneData()?.cpu || phoneData()?.batteryCapacity_mah || phoneData()?.size_in}>
                    <div class="flex flex-col items-end gap-1 text-[13px] text-neutral-500 flex-shrink-0">
                      <Show when={phoneData()?.size_in}>
                        <span>{phoneData()!.size_in}" экран</span>
                      </Show>
                      <Show when={phoneData()?.cpu}>
                        <span class="text-right max-w-[140px] truncate">{phoneData()!.cpu}</span>
                      </Show>
                      <Show when={phoneData()?.batteryCapacity_mah}>
                        <span>{phoneData()!.batteryCapacity_mah} мАч</span>
                      </Show>
                    </div>
                  </Show>
                </div>

                {/* Price highlight */}
                <Show when={minPrice()}>
                  {(() => {
                    const variant = arrowVariant();
                    const colorMap: Record<ArrowVariant, string> = {
                      neutral: "text-neutral-900",
                      up: "text-[hsl(354,100%,64%)]",
                      down: "text-[hsl(158,64%,42%)]",
                      hot: "text-[hsl(25,95%,53%)]",
                      new: "text-[hsl(45,93%,47%)]",
                    };
                    const currencyColorMap: Record<ArrowVariant, string> = {
                      neutral: "text-neutral-400",
                      up: "text-[hsl(354,100%,64%)]/70",
                      down: "text-[hsl(158,64%,42%)]/70",
                      hot: "text-[hsl(25,95%,53%)]/70",
                      new: "text-[hsl(45,93%,47%)]/70",
                    };
                    const indicatorMap: Record<ArrowVariant, { symbol: string; text: string } | null> = {
                      neutral: null,
                      up: { symbol: "↑", text: "Подорожал на 1 700 ₽" },
                      down: { symbol: "↓", text: "Подешевел на 650 ₽" },
                      hot: { symbol: "🔥", text: "Горячая цена" },
                      new: { symbol: null, text: "Новинка" },
                    };
                    const indicator = indicatorMap[variant];
                    return (
                      <div class="mt-4 flex items-baseline gap-2 flex-wrap">
                        <span class="text-[13px] text-neutral-400 uppercase tracking-wide font-medium">от</span>
                        <span class={`text-[28px] font-bold tracking-[-0.02em] ${colorMap[variant]}`}>
                          {formatPrice(minPrice()!)}
                        </span>
                        <span class={`text-[20px] font-medium ${currencyColorMap[variant]}`}>
                          ₽
                          <Show when={indicator}>
                            <span class="text-[18px] ml-1">{indicator!.symbol}</span>
                          </Show>
                        </span>
                        <Show when={indicator}>
                          <span class={`text-[14px] font-medium ml-1 ${colorMap[variant]}`}>
                            {indicator!.text}
                          </span>
                        </Show>
                      </div>
                    );
                  })()}
                </Show>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div class="h-px bg-neutral-100 mx-6" />

          {/* Shop rows */}
          <div class="py-2">
            <For each={shopGroups()}>
              {(group, index) => (
                <a
                  href={group.offers[0]?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex items-center gap-4 px-6 py-3.5 hover:bg-neutral-50/80 transition-colors"
                >
                  {/* Rank */}
                  <div class="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <span class="text-[13px] font-semibold text-neutral-500">{index() + 1}</span>
                  </div>

                  {/* Shop info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-[15px] text-neutral-900 truncate">{group.name}</span>
                    </div>
                    <span class="text-[13px] text-neutral-400 mt-0.5 block">
                      {group.offers.length} предложени{group.offers.length === 1 ? "е" : group.offers.length < 5 ? "я" : "й"}
                    </span>
                  </div>

                  {/* Price */}
                  <div class="flex items-center gap-3 flex-shrink-0">
                    <div class="text-right">
                      <div class="text-[17px] font-semibold text-neutral-900 tabular-nums">
                        от {formatPrice(group.minPrice)} <span class="text-neutral-400 font-normal">₽</span>
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    <svg class="w-5 h-5 text-neutral-300 group-hover:text-[hsl(354,100%,64%)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </a>
              )}
            </For>
          </div>

          {/* Bottom bar */}
          <div class="px-6 py-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between">
            <span class="text-[12px] text-neutral-400">Цены обновлены сегодня</span>
            <span class="text-[12px] text-neutral-400">Реклама</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
