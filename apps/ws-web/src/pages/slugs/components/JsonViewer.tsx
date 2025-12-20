import { createSignal, createEffect, Show, For } from "solid-js";
import { codeToHtml } from "shiki";

interface JsonViewerProps {
  data: unknown;
  loading?: boolean;
  emptyMessage?: string;
  showLineNumbers?: boolean;
}

export function JsonViewer(props: JsonViewerProps) {
  const [html, setHtml] = createSignal<string>("");
  const [highlighting, setHighlighting] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [lines, setLines] = createSignal<string[]>([]);

  const jsonString = () => {
    if (!props.data) return "";
    return JSON.stringify(props.data, null, 2);
  };

  createEffect(async () => {
    const json = jsonString();
    if (!json) {
      setHtml("");
      setLines([]);
      return;
    }

    setHighlighting(true);
    setLines(json.split("\n"));

    try {
      const highlighted = await codeToHtml(json, {
        lang: "json",
        theme: "night-owl",
      });
      setHtml(highlighted);
    } catch (e) {
      console.error("Shiki highlighting failed:", e);
      setHtml(`<pre class="p-4"><code>${json}</code></pre>`);
    } finally {
      setHighlighting(false);
    }
  });

  const copyToClipboard = async () => {
    const json = jsonString();
    if (!json) return;

    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const isLoading = () => props.loading || highlighting();
  const showLines = () => props.showLineNumbers !== false;

  return (
    <div class="h-full flex flex-col bg-[#011627] relative overflow-hidden">
      {/* Loading State */}
      <Show when={isLoading()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <span class="text-xs text-slate-500 font-medium">Processing...</span>
          </div>
        </div>
      </Show>

      {/* Empty State */}
      <Show when={!isLoading() && !props.data}>
        <div class="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
          <div class="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
            <svg
              class="h-8 w-8 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p class="text-sm font-medium">{props.emptyMessage || "No data available"}</p>
        </div>
      </Show>

      {/* Content with Line Numbers */}
      <Show when={!isLoading() && props.data}>
        {/* Top toolbar */}
        <div class="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-[#011627] border-b border-slate-700/30">
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              JSON
            </span>
            <span class="text-[10px] text-slate-600 font-mono">
              {lines().length} lines
            </span>
          </div>

          <button
            onClick={copyToClipboard}
            class={`
              flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
              transition-all duration-200 cursor-pointer
              ${copied()
                ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : "bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200"
              }
            `}
          >
            <Show when={copied()}>
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Copied</span>
            </Show>
            <Show when={!copied()}>
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </Show>
          </button>
        </div>

        {/* Code area with line numbers */}
        <div class="flex-1 overflow-auto overscroll-contain">
          <div class="flex">
            {/* Line numbers gutter */}
            <Show when={showLines()}>
              <div class="sticky left-0 flex-shrink-0 bg-[#011627] border-r border-slate-700/30 select-none">
                <div class="pt-3 pb-3 pl-3 pr-2 text-right font-mono text-[12px] text-slate-600" style="line-height: 18px;">
                  <For each={lines()}>
                    {(_, i) => <div>{i() + 1}</div>}
                  </For>
                </div>
              </div>
            </Show>

            {/* Code content */}
            <div
              class="flex-1 json-code"
              innerHTML={html()}
            />
          </div>
        </div>
        <style>{`
          .json-code pre {
            margin: 0;
            padding: 12px;
            background: transparent !important;
          }
          .json-code code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12px;
            line-height: 18px;
            display: flex;
            flex-direction: column;
            gap: 0;
          }
          .json-code code * {
            margin: 0;
            padding: 0;
          }
          .json-code .line {
            display: block;
            height: 18px;
            margin: 0;
            padding: 0;
          }
          .json-code .line:empty {
            height: 18px;
          }
        `}</style>
      </Show>
    </div>
  );
}
