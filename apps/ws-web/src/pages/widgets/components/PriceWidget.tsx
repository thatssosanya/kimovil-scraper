import { createSignal, createEffect, Show, For } from "solid-js";

interface PriceOffer {
  seller: string;
  price: number;
  variantKey?: string;
  variantLabel?: string;
  url?: string;
  isAvailable?: boolean;
  externalId?: string;
  scrapedAt: number;
}

interface PhoneDataRaw {
  name: string;
  brand: string;
  images: string[] | null;
}

interface PriceWidgetProps {
  slug: string;
}

export function PriceWidget(props: PriceWidgetProps) {
  const [phoneData, setPhoneData] = createSignal<PhoneDataRaw | null>(null);
  const [quotes, setQuotes] = createSignal<PriceOffer[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(async () => {
    const slug = props.slug;
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
    const rubles = minorUnits / 100;
    return rubles.toLocaleString("ru-RU") + " ₽";
  };

  const availableQuotes = () => quotes().filter(q => q.isAvailable !== false);

  return (
    <div class="w-full max-w-[720px] bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden font-['Inter',system-ui,sans-serif]">
      <Show when={loading()}>
        <div class="p-8 flex items-center justify-center">
          <div class="w-8 h-8 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="p-8 text-center text-red-500 text-sm">{error()}</div>
      </Show>

      <Show when={!loading() && !error()}>
        {/* Header with product info */}
        <div class="p-5 flex gap-5 border-b border-zinc-100">
          {/* Product image */}
          <div class="w-20 h-24 bg-zinc-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            <Show 
              when={phoneData()?.images?.[0]} 
              fallback={
                <div class="w-12 h-16 bg-zinc-200 rounded-lg" />
              }
            >
              <img 
                src={phoneData()!.images![0]} 
                alt={phoneData()?.name || "Phone"} 
                class="max-w-full max-h-full object-contain"
              />
            </Show>
          </div>

          {/* Product details */}
          <div class="flex-1 min-w-0">
            <h2 class="text-lg font-semibold text-zinc-900 leading-tight">
              {phoneData()?.brand} {phoneData()?.name || props.slug}
            </h2>
            
            <Show when={availableQuotes().length > 0}>
              <div class="mt-2 flex items-center gap-2">
                <span class="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded">
                  {(Math.random() * 0.5 + 4.5).toFixed(1)}
                </span>
                <span class="text-sm text-zinc-500">
                  {availableQuotes().length} предложени{availableQuotes().length === 1 ? "е" : availableQuotes().length < 5 ? "я" : "й"}
                </span>
              </div>
            </Show>

            <button class="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Все характеристики
            </button>
          </div>

          {/* Logo placeholder */}
          <div class="flex-shrink-0 w-24 flex items-start justify-end">
            <div class="text-right">
              <span class="text-lg font-black tracking-tight">
                <span class="text-zinc-900">PRI</span>
                <span class="text-green-500">C</span>
                <span class="text-pink-500">E</span>
              </span>
              <div class="text-[9px] text-zinc-400 tracking-tight -mt-0.5">ВЫГОДНЕЕ МАРКЕТПЛЕЙСОВ</div>
            </div>
          </div>
        </div>

        {/* Offers list */}
        <div class="divide-y divide-zinc-100">
          <For each={availableQuotes().slice(0, 5)}>
            {(offer) => (
              <div class="px-5 py-4 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors">
                {/* Seller logo placeholder */}
                <div class="w-[88px] h-12 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span class="text-xs font-semibold text-zinc-500 text-center px-2 leading-tight">
                    {offer.seller.split(" ")[0]}
                  </span>
                </div>

                {/* Seller info */}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium text-zinc-900 text-sm">{offer.seller}</span>
                    <Show when={Math.random() > 0.5}>
                      <svg class="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </Show>
                  </div>
                  <div class="flex items-center gap-1 mt-0.5">
                    <svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span class="text-xs text-zinc-600">{(Math.random() * 0.5 + 4.5).toFixed(1)}</span>
                    <span class="text-xs text-zinc-400">• {Math.floor(Math.random() * 300 + 50)} оценок</span>
                  </div>
                </div>

                {/* Delivery info */}
                <div class="w-40 flex-shrink-0">
                  <div class="flex items-center gap-1.5 text-xs text-zinc-600">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Сегодня - от 300 ₽</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Самовывоз есть</span>
                  </div>
                </div>

                {/* Price */}
                <div class="w-28 text-right flex-shrink-0">
                  <div class="text-lg font-semibold text-zinc-900">{formatPrice(offer.price)}</div>
                </div>

                {/* CTA button */}
                <a
                  href={offer.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="px-5 py-2.5 bg-[#5B57E8] hover:bg-[#4845D1] text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
                >
                  В магазин
                </a>
              </div>
            )}
          </For>
        </div>

        {/* Footer */}
        <Show when={availableQuotes().length > 5}>
          <div class="border-t border-zinc-100">
            <button class="w-full py-4 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
              Все предложения
            </button>
          </div>
        </Show>

        {/* Bottom links */}
        <div class="px-5 py-3 bg-zinc-50/50 border-t border-zinc-100 flex items-center justify-between">
          <button class="text-xs text-green-600 hover:text-green-700 font-medium">
            Стать партнёром
          </button>
          <span class="text-xs text-zinc-400">Реклама</span>
        </div>
      </Show>
    </div>
  );
}
