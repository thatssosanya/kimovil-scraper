import { Show } from "solid-js";
import type { SortField } from "../WidgetDebug.types";

export function SortIcon(props: { field: SortField; currentField: SortField; desc: boolean }) {
  return (
    <Show when={props.currentField === props.field}>
      <span class="ml-1 text-indigo-500">{props.desc ? "↓" : "↑"}</span>
    </Show>
  );
}
