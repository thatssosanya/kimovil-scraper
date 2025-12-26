// Widget template generator using template literals - no React dependencies!

interface Device {
  id: string;
  name?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  ratingPosition?: number | null;
  price?: number | null;
  slug?: string | null;
  valueRating?: number | null;
  links?: Array<{
    url: string | null;
    name?: string | null;
    marketplace?: {
      name: string | null;
      iconUrl: string | null;
    } | null;
  }>;
  characteristics?: Array<{
    slug: string | null;
  }>;
}

interface RatingData {
  id: string;
  name: string;
  pageSlug?: string | null;
  devices: Device[];
}

interface WidgetOptions {
  baseUrl?: string;
  showTitle?: boolean;
  className?: string;
  showFooter?: boolean;
}

// Helper functions
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getValueRatingTailwindClasses(value: number): string {
  if (value >= 90) return "bg-gradient-to-br from-[#70DB5D] to-[#40B32C]";
  if (value >= 80) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 70) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 60) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 40) return "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]";
  return "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]";
}

function getRatingBadgeTailwindClasses(position: number): string {
  if (position === 1)
    return "bg-gradient-to-br from-[#F59E0B] to-[#D97706] border-2 border-[#FBBF24]";
  if (position === 2)
    return "bg-gradient-to-br from-[#6B7280] to-[#4B5563] border-2 border-[#9CA3AF]";
  if (position === 3)
    return "bg-gradient-to-br from-[#92400E] to-[#78350F] border-2 border-[#B45309]";
  return "bg-gradient-to-br from-[#374151] to-[#1F2937] border-2 border-[#6B7280]";
}

function formatPrice(price: number): string {
  return price.toLocaleString("ru-RU");
}

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Generate shopping cart SVG icon (matching lucide-react ShoppingCart)
function shoppingCartIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart">
    <circle cx="8" cy="21" r="1"></circle>
    <circle cx="19" cy="21" r="1"></circle>
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57L23 6H6"></path>
  </svg>`;
}

// Generate rating badge HTML with Tailwind classes
function generateRatingBadge(position: number): string {
  return `
    <div class="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-black font-inter-tight tracking-tight z-[15] ${getRatingBadgeTailwindClasses(
      position
    )}">
      ${position}
    </div>
  `;
}

// Generate device card HTML with Tailwind classes
function generateDeviceCard(device: Device): string {
  const description = capitalize(device.description?.trim() || "");
  const deviceName = escapeHtml(device.name || "");
  const imageUrl = device.imageUrl || "/placeholder-device.png";
  const imageAlt = device.name
    ? `${deviceName} - фото устройства`
    : "Изображение устройства";

  const slug = device.characteristics?.[0]?.slug || device.slug;

  const deviceUrl = slug
    ? `https://c.click-or-die.ru/devices/${slug}`
    : device.links?.[0]?.url || "#";

  return `
    <a href="${deviceUrl}" class="widget-carousel__slide flex-none min-w-0 relative flex w-[175px] h-full flex-shrink-0 flex-col items-center gap-1 rounded-3xl bg-[#f3f4f6] p-4 pb-6 transition-colors duration-300 no-underline text-inherit hover:bg-[#e5e7eb]">
      ${device.ratingPosition ? generateRatingBadge(device.ratingPosition) : ""}
      <div class="relative h-[120px] w-full py-4 flex-shrink-0">
        <img 
          src="${imageUrl}" 
          alt="${imageAlt}"
          class="h-full w-full object-contain rounded-lg"
          loading="lazy"
        />
      </div>
      
      <div class="flex w-full items-center justify-start flex-shrink-0">
        <h5 class="text-base font-semibold text-[#111827] text-left m-0">
          ${deviceName}
        </h5>
        ${
          device.valueRating
            ? `
          <div class="ml-2 flex h-6 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${getValueRatingTailwindClasses(
            device.valueRating
          )}" title="Индекс цены/качества: ${device.valueRating}">
            ${device.valueRating}
          </div>
        `
            : ""
        }
      </div>
      
      ${
        description
          ? `
        <div class="w-full flex-grow">
          <p class="text-sm font-medium text-[#6b7280] text-left leading-tight line-clamp-3 break-words m-0">
            ${escapeHtml(description)}${
              description.slice(-1) === "." ? "" : "."
            }
          </p>
        </div>
      `
          : `
        <div class="w-full flex-grow"></div>
      `
      }

      ${
        device.price
          ? `
        <div class="mt-auto flex w-full items-center justify-between flex-shrink-0">
          <div class="text-sm font-semibold text-[#111827]">
            <span class="text-[#6b7280]">от</span> ${formatPrice(
              device.price
            )} ₽
          </div>
          ${
            device.links?.[0]?.url
              ? `
            <button class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-[#111827] text-white border-none transition-colors duration-300 hover:bg-[#f59e0b]" 
              onclick="event.preventDefault(); event.stopPropagation(); window.open('${
                device.links[0].url
              }', '_blank');">
              ${shoppingCartIcon()}
            </button>
          `
              : ""
          }
        </div>
      `
          : ""
      }
    </a>
  `;
}

// Generate the correct rating page URL with rating selection
function generateRatingPageUrl(rating: RatingData, baseUrl: string): string {
  if (rating.pageSlug) {
    // Use the specific page URL with selectedRating parameter for optimal UX
    // This will navigate to the correct page and auto-select the specific rating
    return `${baseUrl}/ratings/${rating.pageSlug}?selectedRating=${rating.id}`;
  }
  // Fallback to general ratings page if no pageSlug is available
  return `${baseUrl}/ratings/`;
}

// Main template generator function with Tailwind classes
export function generateRatingWidgetTemplate(
  rating: RatingData,
  options: WidgetOptions = {}
): string {
  const {
    baseUrl = "https://c.click-or-die.ru",
    showTitle = true,
    className = "cod-widget cod-ratings-widget not-prose",
  } = options;

  const ratingName = escapeHtml(rating.name);
  const ratingPageUrl = generateRatingPageUrl(rating, baseUrl);
  const deviceCards = rating.devices
    .map((device) => generateDeviceCard(device))
    .join("");

  return `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;900&display=swap" rel="stylesheet">
    <div class="cod-widget-container not-prose ${className}" data-widget-type="ratings" data-rating-id="${
    rating.id
  }">
      <div class="max-w-full w-full font-inter-tight">
        ${
          showTitle
            ? `
          <div class="p-4 pt-4 pr-4 pb-0 pl-4">
            <a href="${ratingPageUrl}" class="text-[hsl(354,100%,64%)] text-lg md:text-xl lg:text-2xl font-semibold no-underline block mb-2 leading-tight hover:underline">
              ${ratingName}
            </a>
          </div>
        `
            : ""
        }
        
        <div class="widget-carousel overflow-hidden max-w-full relative p-4 pr-4">
          <div class="widget-carousel__viewport overflow-hidden min-h-[200px]">
            <div class="widget-carousel__container h-full flex gap-3 items-stretch pr-5">
              ${deviceCards}
            </div>
          </div>
          <div class="absolute top-4 right-0 bottom-4 w-16 bg-gradient-to-l from-white to-transparent dark:from-gray-900 pointer-events-none z-10"></div>
        </div>
      </div>
      
      <script>
        (function() {
          const event = new CustomEvent('widgetLoaded', { 
            detail: { widgetType: 'ratings', widgetId: '${rating.id}' },
            bubbles: true 
          });
          document.currentScript.parentElement.dispatchEvent(event);
          
          if (typeof window.initializeWidgetCarousels === 'function') {
            window.initializeWidgetCarousels();
          }
        })();
      </script>
    </div>
  `.trim();
}

// Alternative minimal version without footer for embedding
export function generateMinimalRatingWidget(
  rating: RatingData,
  baseUrl: string = "https://c.click-or-die.ru"
): string {
  return generateRatingWidgetTemplate(rating, {
    baseUrl,
    showFooter: false,
    className: "cod-widget-minimal not-prose",
  });
}

// Version with custom styling
export function generateCustomRatingWidget(
  rating: RatingData,
  baseUrl: string = "https://c.click-or-die.ru",
  customStyles: Record<string, string> = {}
): string {
  // This could be extended to accept custom CSS properties
  return generateRatingWidgetTemplate(rating, {
    baseUrl,
    className: `cod-widget-custom ${customStyles.className || ""}`,
  });
}
