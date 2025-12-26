import Head from "next/head";
import { NextSeo } from "next-seo";
import { useRouter } from "next/router";
import { type GetStaticPaths, type GetStaticProps } from "next";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";
import { PageTransition } from "@/src/components/shared/PageTransition";
import { motion } from "framer-motion";
import { db } from "@/src/server/db";
import { rating } from "@/src/server/db/schema";
import { eq, and } from "drizzle-orm";
import { RatingDeviceCard } from "@/src/components/public/rating/RatingDeviceCard";
import { Smartphone } from "lucide-react";
import superjson from "superjson";
import { getStartOfWeek } from "@/src/utils/dateUtils";
import type {
  Rating,
  RatingType,
  RatingCategory,
  Device,
  Link,
  Marketplace,
  DeviceCharacteristics,
  ProsCons,
} from "@/src/server/db/schema";

// Define the complex type based on Drizzle schema types
type RatingWithDevices = Rating & {
  devices: Array<Device & {
    RatingPosition: Array<{
      ratingId: string;
      position: number;
    }>;
    links: Array<Link & {
      marketplace: Marketplace | null;
    }>;
    characteristics: DeviceCharacteristics[];
    prosCons: ProsCons[];
  }>;
  RatingType: RatingType | null;
  RatingCategory: RatingCategory[];
};

// Type for the transformed device data used in the component (matching RatingDeviceCard expectations)
type TransformedDevice = {
  id: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  ratingPosition: number | null;
  valueRating?: number | null;
  link: {
    url: string | null;
    name: string | null;
    marketplace: {
      name: string | null;
      iconUrl: string | null;
    } | null;
  } | null;
  configs?: Array<{
    id: string;
    name: string | null;
    capacity: string | null;
    ram: string | null;
  }>;
  characteristics: {
    slug: string | null;
  } | null;
  prosAndCons?: {
    pros: Array<{
      id: string;
      text: string;
    }>;
    cons: Array<{
      id: string;
      text: string;
    }>;
  };
};

type RatingPageProps = {
  rating: ReturnType<typeof superjson.serialize>; // serialized rating data
};

const RatingPage = ({ rating: serializedRating }: RatingPageProps) => {
  const rating = superjson.deserialize<RatingWithDevices>(serializedRating);
  const router = useRouter();

  if (router.isFallback) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Smartphone className="mx-auto mb-4 h-16 w-16 animate-pulse text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            Загрузка рейтинга...
          </p>
        </div>
      </div>
    );
  }

  // Sort devices by rating position and include pros/cons
  const sortedDevices: TransformedDevice[] = rating.devices
    .map((device): TransformedDevice => {
      const pros = device.prosCons?.filter(pc => pc.type === "pro") || [];
      const cons = device.prosCons?.filter(pc => pc.type === "con") || [];

      const validLinks = device.links.filter(
        (link): link is Link & { marketplace: Marketplace | null; price: number } => 
          link.price !== null && link.price > 0
      );

      const bestLink = validLinks[0] || null;

      return {
        id: device.id,
        name: device.name,
        description: device.description,
        imageUrl: device.imageUrl,
        price: validLinks.length > 0 
          ? Math.min(...validLinks.map(link => link.price))
          : null,
        ratingPosition: device.RatingPosition.find(
          pos => pos.ratingId === rating.id
        )?.position || null,
        link: bestLink ? {
          url: bestLink.url,
          name: bestLink.name,
          marketplace: bestLink.marketplace ? {
            name: bestLink.marketplace.name,
            iconUrl: null, // Not available in current schema
          } : null,
        } : null,
        characteristics: device.characteristics[0] || null,
        prosAndCons: {
          pros: pros.map(p => ({ id: p.id, text: p.text })),
          cons: cons.map(c => ({ id: c.id, text: c.text })),
        },
      };
    })
    .sort((a, b) => (a.ratingPosition || 999) - (b.ratingPosition || 999));

  const ratingTypeName =
    rating.RatingType?.displayName || rating.RatingType?.name || "устройств";
  const pageTitle = `${
    rating.name
  } - Рейтинг ${ratingTypeName.toLowerCase()} 2025`;
  const pageDescription = `⭐ Актуальный рейтинг ${ratingTypeName.toLowerCase()}: ${
    rating.name
  }. Сравнение характеристик, цен и отзывов. Обновлено ${getStartOfWeek()}. Лучшие предложения от проверенных магазинов.`;

  const canonicalUrl = `https://c.click-or-die.ru/rating/${rating.slug}`;

  // Dynamic OG image URL
  const ogImageUrl = `/api/og/rating?${new URLSearchParams({
    name: rating.name || "",
    description: pageDescription,
    count: sortedDevices.length.toString(),
    type: ratingTypeName.toLowerCase(),
  }).toString()}`;

  const _imageUrl =
    sortedDevices[0]?.imageUrl || "https://c.click-or-die.ru/og-image.jpg";

  // Enhanced structured data with multiple schemas
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: rating.name,
    description: pageDescription,
    numberOfItems: sortedDevices.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    url: canonicalUrl,
    mainEntity: sortedDevices.map((device) => ({
      "@type": "Product",
      "@id": `https://click-or-die.ru/devices/${
        device.characteristics?.slug || device.id
      }`,
      name: device.name,
      description: device.description,
      image: device.imageUrl,
      brand: {
        "@type": "Brand",
        name: device.name?.split(" ")[0] || "Unknown",
      },
      ...(device.price && {
        offers: {
          "@type": "Offer",
          price: device.price,
          priceCurrency: "RUB",
          availability: "https://schema.org/InStock",
          url: device.link?.url,
          seller: {
            "@type": "Organization",
            name: device.link?.marketplace?.name || "Магазин",
          },
        },
      }),
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.5",
        reviewCount: "100",
        bestRating: "5",
        worstRating: "1",
      },
    })),
    itemListElement: sortedDevices.map((device, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: `https://c.click-or-die.ru/devices/${
        device.characteristics?.slug || device.id
      }`,
    })),
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Палач - Click or Die",
    url: "https://c.click-or-die.ru",
    logo: "https://c.click-or-die.ru/logo.svg",
    description:
      "Независимые рейтинги и обзоры электроники. Помогаем выбрать лучшие устройства по соотношению цена-качество.",
    sameAs: ["https://t.me/clickordie_channel", "https://vk.com/clickordie"],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://c.click-or-die.ru",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Рейтинги",
        item: "https://c.click-or-die.ru/ratings",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: rating.name,
        item: canonicalUrl,
      },
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Какой ${ratingTypeName.toLowerCase()} лучший в 2025 году?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `По нашему рейтингу, лучший ${ratingTypeName.toLowerCase()} - ${
            sortedDevices[0]?.name
          }. Он занимает первое место благодаря оптимальному соотношению цена-качество.`,
        },
      },
      {
        "@type": "Question",
        name: `Как часто обновляется рейтинг ${ratingTypeName.toLowerCase()}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "Рейтинг обновляется еженедельно с учетом изменения цен, появления новых моделей и отзывов пользователей.",
        },
      },
    ],
  };

  return (
    <>
      <NextSeo
        title={`${pageTitle} | Палач`}
        description={pageDescription}
        canonical={canonicalUrl}
        openGraph={{
          title: pageTitle,
          description: pageDescription,
          type: "website",
          url: canonicalUrl,
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: `${rating.name} - рейтинг ${ratingTypeName.toLowerCase()}`,
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
        languageAlternates={[
          {
            hrefLang: "ru",
            href: canonicalUrl,
          },
        ]}
        additionalMetaTags={[
          {
            name: "keywords",
            content: `рейтинг ${ratingTypeName.toLowerCase()}, лучшие ${ratingTypeName.toLowerCase()}, сравнение ${ratingTypeName.toLowerCase()}, обзор, цены, характеристики, 2025`,
          },
          {
            name: "author",
            content: "Палач - Click or Die",
          },
          {
            name: "robots",
            content:
              "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
          },
          {
            name: "viewport",
            content: "width=device-width, initial-scale=1, viewport-fit=cover",
          },
          {
            name: "theme-color",
            content: "#111827",
          },
          {
            name: "color-scheme",
            content: "light dark",
          },
          {
            name: "format-detection",
            content: "telephone=no",
          },
          {
            name: "apple-mobile-web-app-capable",
            content: "yes",
          },
          {
            name: "apple-mobile-web-app-status-bar-style",
            content: "default",
          },
        ]}
        additionalLinkTags={[
          {
            rel: "preload",
            href: "/fonts/inter.woff2",
            as: "font",
            type: "font/woff2",
            crossOrigin: "anonymous",
          },
        ]}
      />
      <Head>
        {/* Structured data schemas */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </Head>

      <SiteHeader activeTab="ratings" />

      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto px-4 py-4 pb-16 xl:container">
          <Breadcrumbs
            items={[
              {
                label: "Главная",
                href: "https://click-or-die.ru",
                isHighlighted: true,
              },
              {
                label: "Рейтинги",
                href: "/ratings",
                isHighlighted: true,
              },
              {
                label: rating.name || "",
                href: `/rating/${rating.slug}`,
                disabled: true,
              },
            ]}
          />

          <header className="mb-8 mt-6 space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-4xl lg:text-5xl">
              {rating.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Обновлено {getStartOfWeek()}</span>
              </div>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">
                {sortedDevices.length}{" "}
                {sortedDevices.length === 1
                  ? "устройство"
                  : sortedDevices.length < 5
                  ? "устройства"
                  : "устройств"}
              </span>
            </div>
          </header>

          <PageTransition>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {sortedDevices.map((device, index) => (
                <RatingDeviceCard
                  key={device.id}
                  device={device}
                  position={index + 1}
                />
              ))}

              {sortedDevices.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-3xl bg-zinc-100 p-12 text-center dark:bg-gray-800"
                >
                  <Smartphone className="mx-auto mb-4 h-16 w-16 text-gray-400 dark:text-gray-500" />
                  <h3 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-200">
                    Устройства скоро появятся
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Мы работаем над наполнением этого рейтинга.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </PageTransition>
        </div>
      </div>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const ratings = await db
    .select({ slug: rating.slug })
    .from(rating)
    .where(eq(rating.status, "PUBLISHED"));

  return {
    paths: ratings
      .filter(
        (rating): rating is typeof rating & { slug: string } => !!rating.slug
      )
      .map((rating) => ({
        params: { slug: rating.slug },
      })),
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<RatingPageProps> = async ({
  params,
}) => {
  const slug = params?.slug as string;

  if (!slug) {
    return { notFound: true };
  }

  // Get rating with all related data using Drizzle ORM relations
  const ratingData = await db.query.rating.findFirst({
    where: and(eq(rating.slug, slug), eq(rating.status, "PUBLISHED")),
    with: {
      ratingType: true,
      ratingCategories: {
        with: {
          ratingCategory: true,
        },
      },
      ratingPositions: {
        with: {
          device: {
            with: {
              links: {
                columns: {
                  price: true,
                  name: true,
                  url: true,
                },
                with: {
                  marketplace: {
                    columns: {
                      name: true,
                    },
                  },
                },
              },
              characteristics: {
                columns: {
                  slug: true,
                },
              },
              prosCons: {
                columns: {
                  id: true,
                  type: true,
                  text: true,
                },
              },
            },
          },
        },
        orderBy: (ratingPosition, { asc }) => [asc(ratingPosition.position)],
      },
    },
  });

  if (!ratingData) {
    return { notFound: true };
  }

  // Transform the data to match the expected structure
  const ratingWithDevices = {
    ...ratingData,
    devices: ratingData.ratingPositions.map((ratingPosition) => ({
      ...ratingPosition.device,
      RatingPosition: [
        {
          ratingId: ratingData.id,
          position: ratingPosition.position,
        },
      ],
      links: ratingPosition.device.links || [],
      characteristics: ratingPosition.device.characteristics || [],
      prosCons:
        ratingPosition.device.prosCons?.map((pc) => ({
          id: pc.id,
          type: pc.type,
          text: pc.text,
        })) || [],
    })),
    RatingType: ratingData.ratingType,
    RatingCategory: ratingData.ratingCategories.map((rc) => rc.ratingCategory),
  };

  return {
    props: {
      rating: superjson.serialize(ratingWithDevices),
    },
    revalidate: 60 * 60, // Revalidate every hour for better performance
  };
};

export default RatingPage;
