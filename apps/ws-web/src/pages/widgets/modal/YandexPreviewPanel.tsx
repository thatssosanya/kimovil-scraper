import { For, Show } from "solid-js";

export interface YandexPreviewData {
  name?: string;
  brand?: string;
  suggestedSlug?: string;
  imageUrls: string[];
  specsCount?: number;
  priceCount?: number;
  minPrice?: number;
  maxPrice?: number;
  externalId?: string;
}

interface YandexPreviewPanelProps {
  preview: YandexPreviewData;
  selectedImageUrls: string[];
  onImageToggle: (url: string) => void;
  maxImages?: number;
}

export function YandexPreviewPanel(props: YandexPreviewPanelProps) {
  const maxImages = () => props.maxImages ?? 5;
  const canSelectMore = () => props.selectedImageUrls.length < maxImages();

  const isSelected = (url: string) => props.selectedImageUrls.includes(url);

  const handleImageClick = (url: string) => {
    if (isSelected(url) || canSelectMore()) {
      props.onImageToggle(url);
    }
  };

  return (
    <div class="space-y-4">
      <div class="bg-white dark:bg-slate-900 rounded-lg border border-zinc-200 dark:border-slate-800 p-3">
        <div class="flex items-center gap-2 mb-2">
          <svg
            class="w-4 h-4 text-amber-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
          <span class="text-sm font-semibold text-zinc-900 dark:text-white">
            Yandex Market
          </span>
        </div>
        <div class="text-xs text-zinc-500 dark:text-slate-400 space-y-1">
          <Show when={props.preview.specsCount}>
            <div>{props.preview.specsCount} specs extracted</div>
          </Show>
          <Show when={props.preview.priceCount}>
            <div>
              {props.preview.priceCount} prices found (
              {formatPrice(props.preview.minPrice)} -{" "}
              {formatPrice(props.preview.maxPrice)})
            </div>
          </Show>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wider">
            Select Images ({props.selectedImageUrls.length}/{maxImages()})
          </span>
          <Show when={!canSelectMore()}>
            <span class="text-xs text-amber-600 dark:text-amber-400">
              Max reached
            </span>
          </Show>
        </div>

        <div class="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          <For each={props.preview.imageUrls}>
            {(url) => (
              <button
                onClick={() => handleImageClick(url)}
                disabled={!isSelected(url) && !canSelectMore()}
                class={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected(url)
                    ? "border-emerald-500 ring-2 ring-emerald-500/30"
                    : canSelectMore()
                      ? "border-zinc-200 dark:border-slate-700 hover:border-zinc-400 dark:hover:border-slate-500"
                      : "border-zinc-200 dark:border-slate-700 opacity-50 cursor-not-allowed"
                }`}
              >
                <img src={url} alt="" class="w-full h-full object-cover" />
                <Show when={isSelected(url)}>
                  <div class="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg
                      class="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </Show>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

function formatPrice(price?: number): string {
  if (!price) return "—";
  return price.toLocaleString("ru-RU") + " ₽";
}
