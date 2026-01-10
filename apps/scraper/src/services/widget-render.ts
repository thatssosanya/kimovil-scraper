/**
 * HTML Renderer for Price Widget
 *
 * Produces HTML matching PalachPriceWidget.tsx styling exactly.
 * Uses Tailwind CSS classes for styling (to be used with safelist in ws-web).
 * Pure function with no IO dependencies.
 */

export type ArrowVariant = "neutral" | "up" | "down" | "hot" | "new";

export type WidgetStatus = "loaded" | "empty" | "not_found";

export interface WidgetTrackingContext {
  mappingId?: number;
  postId?: number;
  rawModel?: string;
}

export interface WidgetRenderOptions {
  arrowVariant?: ArrowVariant;
  theme?: "light" | "dark";
  tracking?: WidgetTrackingContext;
}

export interface WidgetModel {
  device: {
    name: string;
    brand: string | null;
    slug: string;
  };
  specs: {
    screenSize: number | null;
    cpu: string | null;
    battery: number | null;
    image: string | null;
  };
  prices: Array<{
    source: string;
    sourceName: string;
    minPrice: number;
    offerCount: number;
    topOffers: Array<{
      seller: string;
      price: number;
      url?: string;
      redirectType?: "to_merchant" | "to_price";
    }>;
  }>;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
  } catch {
    // Invalid URL
  }
  return "#";
}

function formatPrice(minorUnits: number): string {
  const rubles = Math.round(minorUnits / 100);
  return rubles.toLocaleString("ru-RU");
}

function pluralOffers(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "предложение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "предложения";
  return "предложений";
}

const ARROW_VARIANT_CLASSES: Record<ArrowVariant, { main: string; currency: string }> = {
  neutral: { main: "text-neutral-900", currency: "text-neutral-400" },
  up: { main: "text-widget-up", currency: "text-widget-up/70" },
  down: { main: "text-widget-down", currency: "text-widget-down/70" },
  hot: { main: "text-widget-hot", currency: "text-widget-hot/70" },
  new: { main: "text-widget-new", currency: "text-widget-new/70" },
};

const INDICATOR_TEXT: Record<ArrowVariant, { symbol: string | null; text: string } | null> = {
  neutral: null,
  up: { symbol: "↑", text: "Подорожал на 1 700 ₽" },
  down: { symbol: "↓", text: "Подешевел на 650 ₽" },
  hot: { symbol: "🔥", text: "Горячая цена" },
  new: { symbol: null, text: "Новинка" },
};

function renderImagePlaceholder(): string {
  return `<div class="w-10 h-14 sm:w-14 sm:h-20 bg-neutral-100 rounded-lg"></div>`;
}

function renderImage(url: string, alt: string): string {
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="max-w-full max-h-full object-contain" loading="lazy" />`;
}

function renderSpecs(specs: WidgetModel["specs"]): string {
  const items: string[] = [];

  if (specs.screenSize) {
    items.push(`<span>${specs.screenSize}" экран</span>`);
  }
  if (specs.cpu) {
    items.push(`<span class="text-right max-w-[140px] truncate">${escapeHtml(specs.cpu)}</span>`);
  }
  if (specs.battery) {
    items.push(`<span>${specs.battery} мАч</span>`);
  }

  if (items.length === 0) return "";

  return `
    <div class="hidden sm:flex flex-col items-end gap-1 text-[13px] text-neutral-500 flex-shrink-0">
      ${items.join("\n      ")}
    </div>
  `;
}

function renderPriceHighlight(minPrice: number, variant: ArrowVariant): string {
  const classes = ARROW_VARIANT_CLASSES[variant];
  const indicator = INDICATOR_TEXT[variant];

  return `
    <div class="mt-3 sm:mt-4 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
      <span class="text-[12px] sm:text-[13px] text-neutral-400 uppercase tracking-wide font-medium">от</span>
      <span class="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] ${classes.main}">${formatPrice(minPrice)}</span>
      <span class="text-[18px] sm:text-[20px] font-medium ${classes.currency}">₽${indicator?.symbol ? `<span class="text-[16px] sm:text-[18px] ml-1">${indicator.symbol}</span>` : ""}</span>
      ${indicator ? `<span class="text-[13px] sm:text-[14px] font-medium ml-1 ${classes.main}">${escapeHtml(indicator.text)}</span>` : ""}
    </div>
  `;
}

interface ShopRowOptions {
  source: string;
  displayName: string;
  price: number;
  url: string;
  rank: number;
  offerCount?: number;
}

function buildTrackingAttrs(
  tracking: WidgetTrackingContext | undefined,
  deviceSlug: string,
  status: WidgetStatus,
  priceCount: number,
  minPrice?: number,
): string {
  const attrs: string[] = ["data-widget-tracking"];
  
  if (tracking?.mappingId) {
    attrs.push(`data-mapping-id="${tracking.mappingId}"`);
  }
  if (tracking?.postId) {
    attrs.push(`data-post-id="${tracking.postId}"`);
  }
  attrs.push(`data-device-slug="${escapeHtml(deviceSlug)}"`);
  if (tracking?.rawModel) {
    attrs.push(`data-raw-model="${escapeHtml(tracking.rawModel)}"`);
  }
  attrs.push(`data-widget-status="${status}"`);
  attrs.push(`data-price-count="${priceCount}"`);
  if (minPrice !== undefined) {
    attrs.push(`data-min-price="${minPrice}"`);
  }
  
  return attrs.join("\n     ");
}

function renderShopRow(opts: ShopRowOptions): string {
  const url = sanitizeUrl(opts.url);
  const showOfferCount = opts.offerCount !== undefined && opts.offerCount > 1;

  return `
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="group flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-3.5 hover:bg-neutral-50/80 transition-colors"
       data-widget-click
       data-click-target="shop_link"
       data-shop-source="${escapeHtml(opts.source)}"
       data-shop-name="${escapeHtml(opts.displayName)}"
       data-price="${opts.price}"
       data-position="${opts.rank}">
      <!-- Rank -->
      <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
        <span class="text-[12px] sm:text-[13px] font-semibold text-neutral-500">${opts.rank}</span>
      </div>

      <!-- Shop info -->
      <div class="flex-1 min-w-0">
        <span class="font-medium text-[14px] sm:text-[15px] text-neutral-900 truncate block">${escapeHtml(opts.displayName)}</span>
        ${showOfferCount ? `<span class="text-[12px] sm:text-[13px] text-neutral-400 mt-0.5 block">${opts.offerCount} ${pluralOffers(opts.offerCount!)}</span>` : ""}
      </div>

      <!-- Price -->
      <div class="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div class="text-right">
          <div class="text-[15px] sm:text-[17px] font-semibold text-neutral-900 tabular-nums">
            от ${formatPrice(opts.price)} <span class="text-neutral-400 font-normal">₽</span>
          </div>
        </div>
        
        <!-- Arrow -->
        <svg class="w-4 h-4 sm:w-5 sm:h-5 text-neutral-300 group-hover:text-widget-up group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
        </svg>
      </div>
    </a>
  `;
}

function buildShopRows(prices: WidgetModel["prices"]): ShopRowOptions[] {
  const rows: ShopRowOptions[] = [];
  const seenSellers = new Set<string>();

  for (const group of prices) {
    if (group.source === "price_ru") {
      const sortedOffers = [...group.topOffers].sort((a, b) => a.price - b.price);
      for (const offer of sortedOffers) {
        if (seenSellers.has(offer.seller)) continue;
        seenSellers.add(offer.seller);
        rows.push({
          source: "price_ru",
          displayName: offer.seller,
          price: offer.price,
          url: offer.url || "#",
          rank: 0,
        });
      }
    } else if (group.source === "yandex_market") {
      if (group.topOffers.length > 0) {
        const cheapest = group.topOffers.reduce((a, b) => (a.price < b.price ? a : b));
        rows.push({
          source: "yandex_market",
          displayName: group.sourceName,
          price: cheapest.price,
          url: cheapest.url || "#",
          rank: 0,
        });
      }
    } else {
      rows.push({
        source: group.source,
        displayName: group.sourceName,
        price: group.minPrice,
        url: group.topOffers[0]?.url || "#",
        rank: 0,
        offerCount: group.offerCount,
      });
    }
  }

  rows.sort((a, b) => a.price - b.price);

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function renderPriceWidget(model: WidgetModel, options?: WidgetRenderOptions): string {
  const arrowVariant = options?.arrowVariant ?? "neutral";
  const totalOffers = model.prices.reduce((sum, p) => sum + p.offerCount, 0);
  const shopRows = buildShopRows(model.prices);
  const minPrice = shopRows.length > 0 ? Math.min(...shopRows.map((r) => r.price)) : null;
  const deviceName =
    model.device.brand && !model.device.name.startsWith(model.device.brand)
      ? `${model.device.brand} ${model.device.name}`
      : model.device.name;

  const trackingAttrs = buildTrackingAttrs(
    options?.tracking,
    model.device.slug,
    "loaded",
    shopRows.length,
    minPrice ?? undefined,
  );

  return `<div class="widget-price-container w-full max-w-[680px] font-['Inter',system-ui,-apple-system,sans-serif]"
     ${trackingAttrs}>
  <!-- Widget container -->
  <div class="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
    
    <!-- Header -->
    <div class="p-4 pb-4 sm:p-6 sm:pb-5">
      <div class="flex items-start gap-3 sm:gap-5">
        <!-- Product image -->
        <div class="w-[60px] h-[72px] sm:w-[100px] sm:h-[120px] bg-neutral-50 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          ${model.specs.image ? renderImage(model.specs.image, deviceName) : renderImagePlaceholder()}
        </div>

        <!-- Product info -->
        <div class="flex-1 min-w-0 pt-0 sm:pt-1">
          <div class="flex items-start justify-between gap-2 sm:gap-4">
            <div class="flex-1">
              <h2 class="text-[18px] sm:text-[22px] font-semibold text-neutral-900 leading-tight tracking-[-0.02em]">
                ${escapeHtml(deviceName)}
              </h2>
              
              ${
                totalOffers > 0
                  ? `<p class="mt-1.5 sm:mt-2 text-[14px] sm:text-[15px] text-neutral-500">
                ${totalOffers} ${pluralOffers(totalOffers)} от продавцов
              </p>`
                  : ""
              }
            </div>

            <!-- Specs column (hidden on mobile) -->
            ${renderSpecs(model.specs)}
          </div>

          <!-- Price highlight -->
          ${minPrice !== null ? renderPriceHighlight(minPrice, arrowVariant) : ""}
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-neutral-100 mx-4 sm:mx-6"></div>

    <!-- Shop rows -->
    <div class="py-2">
      ${shopRows.map((row) => renderShopRow(row)).join("\n")}
    </div>

    <!-- Bottom bar -->
    <div class="px-4 py-3 sm:px-6 sm:py-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between">
      <span class="text-[11px] sm:text-[12px] text-neutral-400">Цены обновлены сегодня</span>
      <span class="text-[11px] sm:text-[12px] text-neutral-400">Реклама</span>
    </div>
  </div>
</div>`;
}

export function renderEmptyWidget(
  deviceSlug: string,
  options?: WidgetRenderOptions,
): string {
  const trackingAttrs = buildTrackingAttrs(
    options?.tracking,
    deviceSlug,
    "empty",
    0,
    undefined,
  );

  return `<div ${trackingAttrs}
     style="visibility:hidden;height:0;overflow:hidden"></div>`;
}

export function renderNotFoundWidget(
  slug: string,
  options?: WidgetRenderOptions,
): string {
  const trackingAttrs = buildTrackingAttrs(
    options?.tracking,
    slug,
    "not_found",
    0,
    undefined,
  );

  return `<div class="widget-price-container w-full max-w-[680px] font-['Inter',system-ui,-apple-system,sans-serif]"
     ${trackingAttrs}>
  <div class="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
    <div class="p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-4 bg-neutral-50 rounded-full flex items-center justify-center">
        <svg class="w-8 h-8 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="M21 21l-4.35-4.35"></path>
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-neutral-900 mb-2">Устройство не найдено</h2>
      <p class="text-sm text-neutral-500">Не удалось найти «${escapeHtml(slug)}»</p>
    </div>
  </div>
</div>`;
}

export function renderErrorWidget(): string {
  return `<div class="widget-price-container w-full max-w-[680px] font-['Inter',system-ui,-apple-system,sans-serif]">
  <div class="bg-white rounded-2xl border border-neutral-200/60 overflow-hidden">
    <div class="p-12 text-center">
      <div class="w-16 h-16 mx-auto mb-4 bg-red-50 rounded-full flex items-center justify-center">
        <svg class="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <h2 class="text-lg font-semibold text-neutral-900 mb-2">Ошибка загрузки</h2>
      <p class="text-sm text-neutral-500">Не удалось загрузить данные о ценах</p>
    </div>
  </div>
</div>`;
}

/**
 * Get all Tailwind classes used in widget templates.
 * This is exported for use in Tailwind safelist configuration.
 */
export const WIDGET_TAILWIND_CLASSES = [
  // Container
  "widget-price-container",
  "w-full",
  "max-w-[680px]",
  "font-['Inter',system-ui,-apple-system,sans-serif]",
  // Card
  "bg-white",
  "rounded-2xl",
  "border",
  "border-neutral-200/60",
  "overflow-hidden",
  // Header (responsive)
  "p-4",
  "pb-4",
  "p-6",
  "pb-5",
  "p-12",
  "sm:p-6",
  "sm:pb-5",
  "flex",
  "items-start",
  "items-center",
  "items-baseline",
  "items-end",
  "justify-center",
  "justify-between",
  "gap-3",
  "gap-2",
  "gap-1",
  "gap-1.5",
  "sm:gap-5",
  "sm:gap-4",
  "sm:gap-2",
  // Image (responsive)
  "w-[60px]",
  "h-[72px]",
  "w-[100px]",
  "h-[120px]",
  "sm:w-[100px]",
  "sm:h-[120px]",
  "w-16",
  "h-16",
  "w-14",
  "h-20",
  "w-10",
  "h-14",
  "sm:w-14",
  "sm:h-20",
  "w-8",
  "h-8",
  "w-7",
  "h-7",
  "w-6",
  "h-6",
  "sm:w-7",
  "sm:h-7",
  "w-5",
  "h-5",
  "w-4",
  "h-4",
  "sm:w-5",
  "sm:h-5",
  "bg-neutral-50",
  "bg-neutral-100",
  "bg-red-50",
  "rounded-xl",
  "rounded-lg",
  "sm:rounded-xl",
  "rounded-full",
  "flex-shrink-0",
  "max-w-full",
  "max-h-full",
  "object-contain",
  // Text (responsive)
  "flex-1",
  "min-w-0",
  "pt-0",
  "pt-1",
  "sm:pt-1",
  "text-[24px]",
  "text-[22px]",
  "text-[20px]",
  "text-[18px]",
  "text-[17px]",
  "text-[16px]",
  "text-[15px]",
  "text-[14px]",
  "text-[13px]",
  "text-[12px]",
  "text-[11px]",
  "text-[28px]",
  "sm:text-[28px]",
  "sm:text-[22px]",
  "sm:text-[20px]",
  "sm:text-[18px]",
  "sm:text-[17px]",
  "sm:text-[15px]",
  "sm:text-[14px]",
  "sm:text-[13px]",
  "sm:text-[12px]",
  "text-lg",
  "text-sm",
  "font-semibold",
  "font-bold",
  "font-medium",
  "font-normal",
  "text-neutral-900",
  "text-neutral-500",
  "text-neutral-400",
  "text-neutral-300",
  "text-red-500",
  "text-[hsl(354,100%,64%)]",
  "text-[hsl(354,100%,64%)]/70",
  "text-[hsl(158,64%,42%)]",
  "text-[hsl(158,64%,42%)]/70",
  "text-[hsl(25,95%,53%)]",
  "text-[hsl(25,95%,53%)]/70",
  "text-[hsl(45,93%,47%)]",
  "text-[hsl(45,93%,47%)]/70",
  "leading-tight",
  "tracking-[-0.02em]",
  "tracking-wide",
  "uppercase",
  "truncate",
  "text-right",
  "text-center",
  "max-w-[140px]",
  // Spacing (responsive)
  "mt-3",
  "mt-4",
  "sm:mt-4",
  "mt-1.5",
  "mt-2",
  "sm:mt-2",
  "mt-0.5",
  "ml-1",
  "mb-4",
  "mb-2",
  "mx-4",
  "mx-6",
  "sm:mx-6",
  "mx-auto",
  "px-4",
  "px-6",
  "sm:px-6",
  "py-3",
  "py-4",
  "sm:py-4",
  "py-3.5",
  "sm:py-3.5",
  "py-2",
  "flex-wrap",
  // Specs (hidden on mobile)
  "hidden",
  "sm:flex",
  // Divider
  "h-px",
  "bg-neutral-100",
  // Footer
  "bg-neutral-50/50",
  "border-t",
  "border-neutral-100",
  // Shop rows (responsive)
  "group",
  "hover:bg-neutral-50/80",
  "transition-colors",
  "transition-all",
  "tabular-nums",
  "block",
  "flex-col",
  "sm:gap-3",
  // Arrow hover
  "group-hover:text-[hsl(354,100%,64%)]",
  "group-hover:translate-x-0.5",
  "group-hover:-translate-y-0.5",
];
