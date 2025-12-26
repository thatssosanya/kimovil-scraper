import { type GetStaticPaths, type GetStaticPropsContext } from "next";
import { NextSeo } from "next-seo";
import { db } from "@/src/server/db";
import { deviceCharacteristics } from "@/src/server/db/schema";
import { eq } from "drizzle-orm";
import { appRouter } from "@/src/server/api/root";
import { createServerSideHelpers } from "@trpc/react-query/server";
import superjson from "superjson";
import { type Context } from "@/src/server/api/trpc";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";
import { DevicePage } from "@/src/components/public/device/DevicePage";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";
import { useRouter } from "next/router";
import { api } from "@/src/utils/api";

type PageProps = {
  trpcState: unknown;
  slug: string;
};

const DeviceProfilePage = (props: PageProps) => {
  const router = useRouter();
  
  const handleBack = () => {
    // Use browser history for navigation, fallback to ratings page
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.push("/ratings");
    }
  };

  // Get device data for SEO
  const { data: deviceData } =
    api.device.getDeviceCharacteristicBySlug.useQuery(
      { slug: props.slug },
      { enabled: !!props.slug }
    );

  // Handle redirect for duplicate devices
  if (deviceData?.redirectSlug) {
    void router.replace(`/devices/${deviceData.redirectSlug}`);
    return null;
  }

  const canonicalUrl = `https://c.click-or-die.ru/devices/${props.slug}`;
  const pageTitle = deviceData?.name
    ? `${deviceData.name} - Обзор, характеристики и цены 2025 | Палач`
    : "Устройство | Палач";
  const pageDescription = deviceData?.device?.description
    ? `${deviceData.device.description} ⭐ Подробные характеристики, лучшие цены и обзоры. Сравните предложения от проверенных магазинов.`
    : `Подробная информация об устройстве, характеристики, цены и обзоры. Лучшие предложения от проверенных магазинов.`;

  // Dynamic OG image URL
  const ogImageUrl = deviceData?.name
    ? `/api/og/device?${new URLSearchParams({
        name: `${deviceData.name}`,
        ...(deviceData.brand && { brand: deviceData.brand }),
        description: deviceData.device?.description || pageDescription,
        ...(deviceData.device?.imageUrl && {
          image: deviceData.device.imageUrl,
        }),
        ...(deviceData.device?.links?.[0]?.price && {
          price: deviceData.device.links[0].price.toString(),
        }),
        ...(deviceData.device?.valueRating && {
          valueRating: deviceData.device.valueRating.toString(),
        }),
      }).toString()}`
    : "https://c.click-or-die.ru/og-image.jpg";

  return (
    <>
      <NextSeo
        title={pageTitle}
        description={pageDescription}
        canonical={canonicalUrl}
        openGraph={{
          title: pageTitle,
          description: pageDescription,
          type: "product",
          url: canonicalUrl,
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: pageTitle,
            },
          ],
          site_name: "Палач - Click or Die",
        }}
        twitter={{
          cardType: "summary_large_image",
          handle: "@clickordie",
          site: "@clickordie",
        }}
        additionalMetaTags={[
          {
            name: "robots",
            content: "index, follow, max-image-preview:large",
          },
        ]}
      />
      <SiteHeader />
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="mx-auto px-4 py-4 xl:container">
          <Breadcrumbs
            items={[
              {
                label: "Главная",
                href: "https://click-or-die.ru",
                isHighlighted: true,
              },
              { label: "Устройства", href: "/devices" },
              { label: "Рейтинги", href: "/ratings" },
            ]}
          />
          <button
            onClick={handleBack}
            className="hover:text-primary -mb-8 flex text-sm font-medium text-black transition-colors  dark:text-gray-400 dark:hover:text-white"
          >
            ← Вернуться в рейтинги
          </button>
          <DevicePage slug={props.slug} />
        </div>
      </div>
    </>
  );
};

export default DeviceProfilePage;

export const getStaticPaths: GetStaticPaths = async () => {
  const devices = await db
    .select({ slug: deviceCharacteristics.slug })
    .from(deviceCharacteristics)
    .where(eq(deviceCharacteristics.status, PUBLISH_STATUS.PUBLISHED));

  return {
    paths: devices.map((device) => ({
      params: { slug: device.slug },
    })),
    fallback: "blocking",
  };
};

export const getStaticProps = async (
  context: GetStaticPropsContext<{ slug: string }>
): Promise<
  | { props: PageProps; revalidate: number }
  | { notFound: true }
  | { redirect: { destination: string; permanent: boolean } }
> => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: { 
      auth: { userId: null },
      db,
    } as Context,
    transformer: superjson,
  });

  const slug = context.params?.slug;
  if (!slug) {
    return { notFound: true };
  }

  try {
    // Prefetch device characteristics
    await helpers.device.getDeviceCharacteristicBySlug.prefetch({ slug });

    // Get the device data to extract the device ID for additional prefetching
    const deviceData = await helpers.device.getDeviceCharacteristicBySlug.fetch(
      { slug }
    );

    // If device doesn't exist, return 404
    if (!deviceData) {
      return { notFound: true };
    }

    // Handle redirect for duplicate devices at build time (301 redirect for SEO)
    if (deviceData.redirectSlug) {
      return {
        redirect: {
          destination: `/devices/${deviceData.redirectSlug}`,
          permanent: true, // 301 redirect
        },
      };
    }

    // Additional data prefetching if device exists
    if (deviceData.device?.id) {
      try {
        // Prefetch pros and cons (non-critical)
        await helpers.device.getDeviceProsAndCons.prefetch({
          deviceId: deviceData.device.id,
        });
      } catch (error) {
        console.warn("Failed to prefetch pros and cons:", error);
        // Continue without pros/cons data - not critical
      }

      try {
        // Prefetch relevant devices (non-critical)
        await helpers.search.getRelevantDevices.prefetch({
          deviceId: deviceData.device.id,
        });
      } catch (error) {
        console.warn("Failed to prefetch relevant devices:", error);
        // Continue without relevant devices - not critical
      }
    }

    return {
      props: {
        trpcState: helpers.dehydrate(),
        slug,
      },
      revalidate: 60 * 60 * 24, // Revalidate once per day
    };
  } catch (error) {
    console.error("Error in getStaticProps for device:", slug, error);

    // Different handling based on error type
    if (error instanceof Error) {
      // Database connection or query error
      if (
        error.message.includes("database") ||
        error.message.includes("connect")
      ) {
        console.error("Database error during device prefetch:", error);
        // Return ISR page without prefetched data
        return {
          props: {
            trpcState: helpers.dehydrate(),
            slug,
          },
          revalidate: 300, // Shorter revalidation on errors (5 minutes)
        };
      }
    }

    // For all other errors, show 404
    return { notFound: true };
  }
};
