import { NextSeo } from "next-seo";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";
import { db } from "@/src/server/db";
import { ratingsPage } from "@/src/server/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { cn } from "@/src/lib/utils";
import { RatingGroup } from "@/src/components/public/rating/RatingGroup";
import { Smartphone } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { PageTransition } from "@/src/components/shared/PageTransition";
import { motion } from "framer-motion";
import { type InferGetStaticPropsType, type GetStaticPaths } from "next";
import { getStartOfWeek } from "@/src/utils/dateUtils";

// Define transformation types
type TransformedDevice = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  ratingPosition: number | null;
  slug: string | null;
  customDescription: string | null;
  price: number | null;
  link: {
    url: string | null;
    name: string | null;
    marketplace: {
      name: string | null;
      iconUrl: string | null;
    };
  } | null;
  configs: Set<{
    id: string;
    name: string | null;
    capacity: string | null;
    ram: string | null;
  }>;
};

type TransformedRating = {
  id: string;
  rating: {
    id: string;
    name: string;
    slug: string | null;
    devices: Map<string, TransformedDevice>;
    RatingsGroupPosition: Array<{
      id: string;
      shortName: string | null;
      position: number;
    }>;
  };
};

type TransformedGroup = {
  id: string;
  group: {
    id: string;
    name: string;
    type: string;
    displayType: string;
    ratings: Map<string, TransformedRating>;
  };
};

type TransformedPage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  groups: Map<string, TransformedGroup>;
};

export type RatingPageProps = InferGetStaticPropsType<typeof getStaticProps>;

const RatingPageSlug = ({ pageData, allPages }: RatingPageProps) => {
  const router = useRouter();

  const handlePageSelect = useCallback(
    (pageSlug: string) => {
      // Clear selectedRating when navigating between pages to prevent unwanted scrolling
      void router.push({ pathname: `/ratings/${pageSlug}` }, undefined, {
        scroll: false,
      });
    },
    [router]
  );

  // Count total devices across all groups and ratings
  const totalDevices =
    pageData.groups?.reduce((total, group) => {
      return (
        total +
        (group.group?.ratings?.reduce((ratingTotal, rating) => {
          return ratingTotal + (rating.rating?.devices?.length || 0);
        }, 0) || 0)
      );
    }, 0) || 0;

  // Dynamic OG image URL
  const ogImageUrl = `/api/og/rating?${new URLSearchParams({
    name: pageData.name,
    description:
      pageData.description ||
      `Лучшие ${pageData.name.toLowerCase()} с улучшенным интерфейсом и функциональностью.`,
    count: totalDevices.toString(),
    type: pageData.name.toLowerCase(),
  }).toString()}`;

  return (
    <>
      <NextSeo
        title={`Палач | ${pageData.name}`}
        description={
          pageData.description ||
          `Лучшие ${pageData.name.toLowerCase()} с улучшенным интерфейсом и функциональностью.`
        }
        canonical={`https://c.click-or-die.ru/ratings/${pageData.slug}`}
        openGraph={{
          title: `Палач | ${pageData.name}`,
          description:
            pageData.description ||
            `Лучшие ${pageData.name.toLowerCase()} с улучшенным интерфейсом и функциональностью.`,
          type: "website",
          url: `https://c.click-or-die.ru/ratings/${pageData.slug}`,
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: `Палач | ${pageData.name}`,
            },
          ],
          site_name: "Палач - Click or Die",
        }}
        twitter={{
          cardType: "summary_large_image",
        }}
      />
      <SiteHeader activeTab="ratings" />
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <div className="mx-auto px-4 py-4 pb-16 xl:container">
          <Breadcrumbs
            items={[
              {
                label: "Главная",
                href: "https://click-or-die.ru",
                isHighlighted: true,
              },
              { label: "Рейтинги", href: "/ratings", isHighlighted: true },
              {
                label: pageData.name,
                href: `/ratings/${pageData.slug}`,
                disabled: true,
              },
            ]}
          />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            Лучшие {pageData.name.toLowerCase()}
          </h1>
          <div className="mt-3 hidden items-center gap-2 text-sm text-gray-400 dark:text-gray-500 md:flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            <span>Обновлено {getStartOfWeek()}</span>
          </div>
          <div className="scrollbar -mb-3 mt-6 flex flex-wrap gap-1 overflow-x-auto pb-3">
            {allPages.map((page) => (
              <div
                className={cn(
                  "flex w-max flex-shrink-0 cursor-pointer items-center gap-1 rounded-full p-3 md:p-4",
                  pageData.id === page.id &&
                    "cursor-default bg-gray-100 dark:bg-gray-800"
                )}
                onClick={() => handlePageSelect(page.slug)}
                key={page.id}
              >
                {page.iconName ? (
                  <DynamicIcon
                    name={page.iconName as "replace"}
                    className="text-primary h-5 w-5 font-bold"
                    fallback={() => (
                      <Smartphone className="text-primary h-5 w-5 font-bold" />
                    )}
                  />
                ) : (
                  <Smartphone className="text-primary h-5 w-5 text-sm font-bold md:text-base" />
                )}
                <h2 className="text-base font-semibold leading-4 text-gray-900 dark:text-white">
                  {page.name}
                </h2>
              </div>
            ))}
          </div>
          <PageTransition>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                mass: 0.1,
                bounce: 1,
                stiffness: 400,
                damping: 20,
              }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 space-y-12"
            >
              {pageData.groups?.map(
                (group) =>
                  group.group && (
                    <RatingGroup
                      key={group.group.id}
                      pageName={pageData.name}
                      {...group}
                    />
                  )
              )}
            </motion.div>
          </PageTransition>
        </div>
      </div>
    </>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await db
    .select({ slug: ratingsPage.slug })
    .from(ratingsPage)
    .where(eq(ratingsPage.status, "PUBLISHED"));

  return {
    paths: pages.map((page) => ({
      params: { slug: page.slug },
    })),
    fallback: "blocking",
  };
};

export async function getStaticProps({ params }: { params: { slug: string } }) {
  const currentSlug = params.slug;

  // Get all published pages for navigation
  const allPages = await db
    .select({
      id: ratingsPage.id,
      name: ratingsPage.name,
      slug: ratingsPage.slug,
      iconName: ratingsPage.iconName,
    })
    .from(ratingsPage)
    .where(eq(ratingsPage.status, "PUBLISHED"))
    .orderBy(asc(ratingsPage.position));

  // Find the current page
  const currentPage = allPages.find((page) => page.slug === currentSlug);
  if (!currentPage) {
    return { notFound: true };
  }


  // Use simplified query that works with current Drizzle schema
  const rawResults = await db.all(
    sql`
    SELECT 
      -- RatingsPage
      rp.id as page_id,
      rp.name as page_name,
      rp.slug as page_slug,
      rp.description as page_description,
      rp.iconName as page_icon_name,
      
      -- RatingsPagePosition  
      rpp.id as page_position_id,
      rpp.position as page_position,
      
      -- RatingsGroup
      rg.id as group_id,
      rg.name as group_name,
      rg.type as group_type,
      rg.displayType as group_display_type,
      -- RatingsGroupPosition
      rgp.id as group_position_id,
      rgp.position as group_position,
      rgp.shortName as group_short_name,
      
      -- Rating
      r.id as rating_id,
      r.name as rating_name,
      r.slug as rating_slug,

      -- Device
      d.id as device_id,
      d.name as device_name,
      d.imageUrl as device_image_url,
      d.description as device_description,
      
      -- RatingPosition (device position in this specific rating)
      rpos.position as device_rating_position,
      rpos.customDescription as device_custom_description,
      
      -- Device characteristics slug
      dc.slug as device_slug,
      
      -- Links/Prices (get cheapest price per device) - simplified
      l.price as device_price,
      l.url as device_link_url,
      l.name as device_link_name,
      m.name as marketplace_name,
      m.iconUrl as marketplace_icon,
      
      -- Config - simplified
      c.id as config_id,
      c.name as config_name,
      c.capacity as config_capacity,
      c.ram as config_ram
      
    FROM RatingsPage rp
    JOIN RatingsPagePosition rpp ON rp.id = rpp.pageId
    JOIN RatingsGroup rg ON rpp.groupId = rg.id
    JOIN RatingsGroupPosition rgp ON rg.id = rgp.groupId
    JOIN Rating r ON rgp.ratingId = r.id
    LEFT JOIN _DeviceToRating dtr ON dtr.B = r.id
    LEFT JOIN Device d ON d.id = dtr.A
    LEFT JOIN RatingPosition rpos ON rpos.ratingId = r.id AND rpos.deviceId = d.id
    LEFT JOIN DeviceCharacteristics dc ON d.id = dc.deviceId
    LEFT JOIN Link l ON d.id = l.deviceId AND l.price > 0
    LEFT JOIN Marketplace m ON l.marketplaceId = m.id
    LEFT JOIN _ConfigToDevice cd ON d.id = cd.B
    LEFT JOIN Config c ON cd.A = c.id
    
    WHERE rp.status = 'PUBLISHED' AND r.status = 'PUBLISHED' AND rp.slug = ${currentSlug}
    
    ORDER BY 
      COALESCE(rp.position, 999) ASC,
      rpp.position ASC,
      rgp.position ASC,
      COALESCE(rpos.position, 999) ASC,
      d.name ASC,
      COALESCE(l.price, 999999) ASC
  `
  ) as Array<{
      page_id: string;
      page_name: string;
      page_slug: string;
      page_description: string | null;
      page_icon_name: string | null;
      page_position_id: string;
      page_position: number;
      group_id: string;
      group_name: string;
      group_type: string;
      group_position_id: string;
      group_position: number;
      group_short_name: string | null;
      group_display_type: string;
      rating_id: string;
      rating_name: string;
      rating_slug: string | null;
      device_id: string;
      device_name: string | null;
      device_image_url: string | null;
      device_slug: string | null;
      device_description: string | null;
      device_rating_position: number | null;
      device_custom_description: string | null;
      device_price: number | null;
      device_link_url: string | null;
      device_link_name: string | null;
      marketplace_name: string | null;
      marketplace_icon: string | null;
      config_id: string | null;
      config_name: string | null;
      config_capacity: string | null;
      config_ram: string | null;
    }>;

  if (rawResults.length === 0) {
    return { notFound: true };
  }

  // Transform raw results back to nested structure
  const groupsMap = new Map<string, TransformedGroup>();

  const pageData: TransformedPage = {
    id: rawResults[0]!.page_id,
    name: rawResults[0]!.page_name,
    slug: rawResults[0]!.page_slug,
    description: rawResults[0]!.page_description,
    iconName: rawResults[0]!.page_icon_name,
    groups: groupsMap,
  };

  rawResults.forEach((row) => {
    // Get or create group position
    if (!pageData.groups.has(row.page_position_id)) {
      pageData.groups.set(row.page_position_id, {
        id: row.page_position_id,
        group: {
          id: row.group_id,
          type: row.group_type,
          name: row.group_name,
          displayType: row.group_display_type,
          ratings: new Map<string, TransformedRating>(),
        },
      });
    }

    const groupPosition = pageData.groups.get(row.page_position_id)!;

    // Get or create rating
    if (!groupPosition.group.ratings.has(row.group_position_id)) {
      groupPosition.group.ratings.set(row.group_position_id, {
        id: row.group_position_id,
        rating: {
          id: row.rating_id,
          name: row.rating_name,
          slug: row.rating_slug,
          devices: new Map<string, TransformedDevice>(),
          RatingsGroupPosition: [
            {
              id: row.group_position_id,
              shortName: row.group_short_name,
              position: row.group_position,
            },
          ],
        },
      });
    }

    const rating = groupPosition.group.ratings.get(row.group_position_id)!;

    // Get or create device (skip if device_id is null)
    if (row.device_id && !rating.rating.devices.has(row.device_id)) {
      rating.rating.devices.set(row.device_id, {
        id: row.device_id,
        name: row.device_name,
        imageUrl: row.device_image_url,
        description: row.device_description,
        slug: row.device_slug,
        ratingPosition: row.device_rating_position,
        customDescription: row.device_custom_description,
        price: row.device_price,
        link: row.device_link_url
          ? {
              url: row.device_link_url,
              name: row.device_link_name,
              marketplace: {
                name: row.marketplace_name,
                iconUrl: row.marketplace_icon,
              },
            }
          : null,
        configs: new Set(),
      });
    }

    // Add config if present (only if device exists)
    if (row.device_id && row.config_id) {
      const device = rating.rating.devices.get(row.device_id);
      if (device) {
        device.configs.add({
          id: row.config_id,
          name: row.config_name,
          capacity: row.config_capacity,
          ram: row.config_ram,
        });
      }
    }
  });

  // Convert Maps and Sets back to arrays
  const processedPageData = {
    ...pageData,
    groups: Array.from(pageData.groups.values()).map((groupPos) => ({
      ...groupPos,
      group: {
        ...groupPos.group,
        ratings: Array.from(groupPos.group.ratings.values()).map((rating) => ({
          ...rating,
          rating: {
            ...rating.rating,
            devices: Array.from(rating.rating.devices.values()).map(
              (device) => ({
                ...device,
                configs: Array.from(device.configs).map((config) => ({
                  name: config.name,
                  capacity: config.capacity,
                })),
              })
            ),
          },
        })),
      },
    })),
  };

  return {
    props: {
      pageData: processedPageData,
      allPages,
    },
    revalidate: 60 * 5, // Revalidate every 5 minutes
  };
}

export default RatingPageSlug;
