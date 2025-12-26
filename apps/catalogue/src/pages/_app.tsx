import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { api } from "@/src/utils/api";
import { Inter_Tight } from "next/font/google";
import "../styles/globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { YandexMetricaProvider } from "next-yandex-metrica";
import { Toaster } from "sonner";

export const interTight = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "900"],
  variable: "--font-inter-tight",
  display: "swap",
});

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps,
}) => {
  return (
    <div style={{ fontFamily: interTight.style.fontFamily }}>
      <YandexMetricaProvider
        tagID={102747543}
        initParameters={{
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
        }}
        router="pages"
      >
        <ClerkProvider {...pageProps}>
          <Toaster richColors />
          <Component {...pageProps} />
        </ClerkProvider>
      </YandexMetricaProvider>
    </div>
  );
};

export default api.withTRPC(MyApp);
