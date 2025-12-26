import { NextSeo } from "next-seo";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";
import { motion } from "framer-motion";
import superjson from "superjson";
import { type InferGetStaticPropsType } from "next";
import { BrandSection } from "@/src/components/public/device/BrandSection";
import {
  fetchDevicesData,
  transformDevicesData,
} from "@/src/server/utils/deviceUtils";
import type { DevicesProps } from "@/src/types/devices";

type DevicesIndexPageProps = InferGetStaticPropsType<typeof getStaticProps>;

const DevicesIndexPage = (props: DevicesIndexPageProps) => {
  const { brandGroups, totalDevices }: DevicesProps =
    superjson.deserialize(props);

  return (
    <>
      <NextSeo
        title="Каталог устройств 2025 — Палач | Смартфоны, планшеты, ноутбуки"
        description={`📱 Полный каталог ${totalDevices} современных устройств от ведущих производителей. Смартфоны, планшеты, ноутбуки с подробными характеристиками, обзорами и лучшими ценами.`}
        canonical="https://c.click-or-die.ru/devices"
        openGraph={{
          title: "Каталог устройств 2025 — Палач",
          description: `📱 ${totalDevices} современных устройств от ведущих производителей. Подробные характеристики, обзоры и лучшие цены.`,
          type: "website",
          url: "https://c.click-or-die.ru/devices",
          images: [
            {
              url: "https://c.click-or-die.ru/og-image.jpg",
              width: 1200,
              height: 630,
              alt: "Каталог устройств — Палач",
            },
          ],
          site_name: "Палач - Click or Die",
          locale: "ru_RU",
        }}
        twitter={{
          cardType: "summary_large_image",
          site: "@clickordie",
          handle: "@clickordie",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: "каталог смартфонов, каталог устройств, телефоны, планшеты, ноутбуки, характеристики, обзоры устройств, цены",
          },
          {
            name: "robots",
            content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
          },
          {
            name: "author",
            content: "Палач - Click or Die",
          },
        ]}
      />
      <SiteHeader activeTab="devices" />
      <div className="min-h-screen bg-white text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-white">
        <div className="mx-auto px-4 py-6 pb-20 xl:container">
          <Breadcrumbs
            items={[
              {
                label: "Главная",
                href: "https://c.click-or-die.ru/",
                isHighlighted: true,
              },
              { label: "Устройства", href: "/devices", disabled: true },
            ]}
          />

          <header className="mb-12 mt-6">
            <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
              Каталог устройств
            </h1>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400 sm:text-2xl">
              {totalDevices}{" "}
              {totalDevices === 1
                ? "устройство"
                : totalDevices < 5
                ? "устройства"
                : "устройств"}{" "}
              от ведущих производителей
            </p>
          </header>

          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              mass: 0.2,
              stiffness: 300,
              damping: 25,
            }}
            className="space-y-20"
          >
            {brandGroups.map((brandGroup) => (
              <BrandSection key={brandGroup.brand} brandGroup={brandGroup} />
            ))}
          </motion.main>
        </div>
      </div>
    </>
  );
};

export async function getStaticProps() {
  const rawResults = await fetchDevicesData();
  const { brandGroups, totalDevices } = transformDevicesData(rawResults);

  return {
    props: superjson.serialize({
      brandGroups,
      totalDevices,
    }),
    revalidate: 60 * 60 * 6, // Revalidate every 6 hours
  };
}

export default DevicesIndexPage;
