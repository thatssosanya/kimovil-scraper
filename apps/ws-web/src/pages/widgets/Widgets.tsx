import { Header } from "../../components/Header";
import { PalachPriceWidget } from "./components/PalachPriceWidget";

export default function Widgets() {
  return (
    <div class="min-h-screen bg-zinc-100 dark:bg-slate-950">
      <Header currentPage="widgets" />
      <div class="flex items-center justify-center py-16 px-4">
        <PalachPriceWidget slug="samsung-galaxy-a16-4g" />
      </div>
    </div>
  );
}
