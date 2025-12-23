import { Show, createSignal, createMemo } from "solid-js";
import { useSelection, useRowData, useActions } from "../context/devices-table.context";
import { DataStatusIcons } from "./DataStatusIcons";
import { RowActionsMenu } from "./RowActionsMenu";
import type { Device } from "../types";

interface DeviceRowProps {
  device: Device;
  index: number;
}

function QueueStatusBadge(props: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    pending: { class: "bg-amber-500/10 text-amber-400 ring-amber-500/20", label: "Pending" },
    running: { class: "bg-indigo-500/10 text-indigo-400 ring-indigo-500/20 animate-pulse", label: "Running" },
    done: { class: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20", label: "Done" },
    error: { class: "bg-rose-500/10 text-rose-400 ring-rose-500/20", label: "Error" },
  };

  const cfg = config[props.status] || config.pending;

  return (
    <span class={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ring-1 ${cfg.class}`}>
      {cfg.label}
    </span>
  );
}

function ActionButton(props: {
  onClick: () => void;
  disabled?: boolean;
  variant: "fast" | "full" | "view";
  title: string;
}) {
  const variants = {
    fast: {
      class: "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    full: {
      class: "text-violet-400 hover:text-violet-300 hover:bg-violet-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
    },
    view: {
      class: "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10",
      icon: (
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  };

  const v = variants[props.variant];

  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      class={`
        p-1.5 rounded-md transition-all duration-150 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed
        ${v.class}
      `}
    >
      {v.icon}
    </button>
  );
}

export function DeviceRow(props: DeviceRowProps) {
  const selection = useSelection();
  const rowData = useRowData();
  const actions = useActions();
  
  const [_expanded, _setExpanded] = createSignal(false);

  const status = () => rowData.getStatus(props.device.slug);
  const queue = () => rowData.getQueue(props.device.slug);
  const queueLoading = () => rowData.getQueueLoading(props.device.slug);

  const isSelected = createMemo(() => selection.isSelected(props.device.slug));
  const isCorrupted = createMemo(() => status()?.isCorrupted === true);

  const canViewData = createMemo(() => {
    const s = status();
    return s?.hasHtml || s?.hasRawData || s?.hasAiData;
  });

  const hasAnyData = createMemo(() => {
    const s = status();
    return s?.hasHtml || s?.hasRawData || s?.hasAiData || queue();
  });

  const isQueued = createMemo(() => {
    const q = queue();
    return q && (q.status === "pending" || q.status === "running");
  });

  const needsScrape = createMemo(() => {
    return !status()?.hasHtml && !isQueued();
  });

  const handleRowClick = (e: MouseEvent) => {
    selection.handleRowClick(props.device.slug, props.index, e);
  };

  const handleClearAll = () => {
    actions.clearAllData(props.device.slug);
  };

  const handleClearRaw = () => {
    if (confirm(`Clear raw data for "${props.device.slug}"?`)) {
      actions.clearRawData(props.device.slug);
    }
  };

  const handleClearAi = () => {
    if (confirm(`Clear AI data for "${props.device.slug}"?`)) {
      actions.clearAiData(props.device.slug);
    }
  };

  return (
    <tr
      class={`
        group transition-colors duration-150
        ${isSelected() ? "bg-indigo-500/5" : "hover:bg-slate-800/30"}
        ${isCorrupted() ? "bg-rose-500/5" : ""}
      `}
      onClick={handleRowClick}
    >
      {/* Checkbox */}
      <td class="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected()}
          onChange={() => selection.handleRowClick(props.device.slug, props.index, new MouseEvent("click"))}
          class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 focus:ring-offset-0 cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
        />
      </td>

      {/* Device */}
      <td class="px-4 py-2">
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-medium text-slate-200 truncate" title={props.device.name}>
            {props.device.name}
          </span>
          <span class="text-[11px] font-mono text-slate-500 truncate" title={props.device.slug}>
            {props.device.slug}
          </span>
        </div>
      </td>

      {/* Brand */}
      <td class="px-4 py-2">
        <span class="text-sm text-slate-400">
          {props.device.brand || "—"}
        </span>
      </td>

      {/* Data Status */}
      <td class="px-4 py-2">
        <DataStatusIcons status={status()} />
      </td>

      {/* Queue Status */}
      <td class="px-4 py-2">
        <Show when={queue()}>
          <QueueStatusBadge status={queue()!.status} />
        </Show>
      </td>

      {/* Actions */}
      <td class="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          {/* Scrape buttons */}
          <Show when={needsScrape()}>
            <ActionButton
              variant="fast"
              title="Fast scrape (HTML + Raw)"
              onClick={() => actions.queueScrape(props.device.slug, "fast")}
              disabled={queueLoading()}
            />
            <ActionButton
              variant="full"
              title="Full scrape (+ AI processing)"
              onClick={() => actions.queueScrape(props.device.slug, "complex")}
              disabled={queueLoading()}
            />
          </Show>

          {/* View button */}
          <Show when={canViewData()}>
            <ActionButton
              variant="view"
              title="View data"
              onClick={() => actions.openModal(props.device.slug)}
            />
          </Show>

          {/* Overflow menu for destructive actions */}
          <RowActionsMenu
            slug={props.device.slug}
            hasAnyData={!!hasAnyData()}
            hasRawData={status()?.hasRawData ?? false}
            hasAiData={status()?.hasAiData ?? false}
            onClearAll={handleClearAll}
            onClearRaw={handleClearRaw}
            onClearAi={handleClearAi}
          />
        </div>
      </td>
    </tr>
  );
}
