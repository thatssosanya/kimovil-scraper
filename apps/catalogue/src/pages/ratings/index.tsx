import { NextSeo } from "next-seo";
import Link from "next/link";
import { useRouter } from "next/router";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";
import { Smartphone, ArrowRight } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { PageTransition } from "@/src/components/shared/PageTransition";
import { motion } from "framer-motion";
import { db } from "@/src/server/db";
import type { 
  RatingsPage, 
  RatingsPagePosition, 
  RatingsGroup, 
  RatingsGroupPosition, 
  Rating 
} from "@/src/server/db/schema";
import superjson from "superjson";
import { type InferGetStaticPropsType } from "next";

// Define proper type for ratings page with all relations
type RatingsPageWithIncludes = RatingsPage & {
  groups: Array<RatingsPagePosition & {
    group: RatingsGroup & {
      ratings: Array<RatingsGroupPosition & {
        rating: Rating;
      }>;
    };
  }>;
};

type RatingsIndexPageProps = InferGetStaticPropsType<typeof getStaticProps>;

const RatingsIndex = (props: RatingsIndexPageProps) => {
  const ratingsPages = superjson.deserialize<RatingsPageWithIncludes[]>(
    props.ratingsPages
  );
  const router = useRouter();

  const handleRatingClick = (
    pageSlug: string,
    _groupId: string,
    ratingId: string
  ) => {
    // Navigate to the ratings page with the selected rating
    void router.push(`/ratings/${pageSlug}?selectedRating=${ratingId}`);
  };

  return (
    <>
      <NextSeo
        title="Рейтинги лучших устройств 2025 — Палач"
        description="🏆 Полные рейтинги лучших смартфонов, планшетов и других устройств 2025 года. Объективные обзоры, сравнение характеристик и лучшие цены от проверенных магазинов."
        canonical="https://c.click-or-die.ru/ratings"
        openGraph={{
          title: "Рейтинги лучших устройств 2025 — Палач",
          description: "🏆 Полные рейтинги лучших смартфонов, планшетов и других устройств. Лучшие цены и объективные обзоры.",
          type: "website",
          url: "https://c.click-or-die.ru/ratings",
          images: [
            {
              url: "https://c.click-or-die.ru/og-image.jpg",
              width: 1200,
              height: 630,
              alt: "Рейтинги лучших устройств — Палач",
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
            content: "рейтинги смартфонов 2025, лучшие телефоны, рейтинг телефонов, обзоры устройств, сравнение смартфонов",
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
      <SiteHeader activeTab="ratings" />
      <div className="min-h-screen bg-white text-gray-900 transition-colors duration-200 dark:bg-gray-900 dark:text-white">
        <div className="container mx-auto overflow-hidden px-4 py-4 pb-16">
          <Breadcrumbs
            items={[
              {
                label: "Главная",
                href: "https://c.click-or-die.ru/",
                isHighlighted: true,
              },
              { label: "Рейтинги", href: "/ratings", disabled: true },
            ]}
          />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            Рейтинги устройств
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-gray-500 dark:text-gray-400">
            Актуальные подборки лучших устройств с ценами от проверенных магазинов
          </p>

          <PageTransition>
            <div className="mt-10 space-y-5">
              {ratingsPages?.map((page) => (
                <motion.div
                  key={page.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Link href={`/ratings/${page.slug}`}>
                    <div className="group cursor-pointer rounded-2xl bg-gray-50 p-5 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5">
                            {page.iconName ? (
                              <DynamicIcon
                                name={page.iconName as "smartphone"}
                                className="text-primary h-6 w-6"
                                fallback={() => (
                                  <Smartphone className="text-primary h-6 w-6" />
                                )}
                              />
                            ) : (
                              <Smartphone className="text-primary h-6 w-6" />
                            )}
                            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                              {page.name}
                            </h2>
                          </div>

                          {page.description && (
                            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                              {page.description}
                            </p>
                          )}

                          <div className="mt-4 space-y-3">
                            {page.groups.map((groupPosition) => (
                              <div
                                key={groupPosition.group.id}
                                className="space-y-1.5"
                              >
                                <h4 className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                  {groupPosition.group.name}
                                </h4>
                                <div className="flex flex-wrap gap-1">
                                  {groupPosition.group.ratings.map(
                                    (ratingPosition) => (
                                      <button
                                        key={ratingPosition.rating.id}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleRatingClick(
                                            page.slug,
                                            groupPosition.group.id,
                                            ratingPosition.rating.id
                                          );
                                        }}
                                        className="hover:bg-primary rounded-full bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-150 hover:text-white dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-primary dark:hover:text-white"
                                      >
                                        {ratingPosition.shortName ||
                                          ratingPosition.rating.name}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center transition-transform duration-200 group-hover:translate-x-1">
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}

              {(!ratingsPages || ratingsPages.length === 0) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-gray-50 p-12 text-center dark:bg-gray-800"
                >
                  <Smartphone className="text-primary mx-auto mb-3 h-10 w-10" />
                  <h3 className="mb-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                    Рейтинги скоро появятся
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Мы работаем над созданием новых рейтингов устройств.
                  </p>
                </motion.div>
              )}
            </div>
          </PageTransition>
        </div>
      </div>
    </>
  );
};

export async function getStaticProps() {
  try {
    // Get ratings pages with all related data using Drizzle query relations
    const ratingsPagesData = await db.query.ratingsPage.findMany({
      where: (ratingsPage, { eq }) => eq(ratingsPage.status, "PUBLISHED"),
      orderBy: (ratingsPage, { asc }) => [asc(ratingsPage.position)],
      with: {
        groups: {
          orderBy: (ratingsPagePosition, { asc }) => [asc(ratingsPagePosition.position)],
          with: {
            group: {
              with: {
                ratings: {
                  orderBy: (ratingsGroupPosition, { asc }) => [asc(ratingsGroupPosition.position)],
                  with: {
                    rating: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      props: {
        ratingsPages: superjson.serialize(ratingsPagesData),
      },
      revalidate: 60 * 60 * 2, // Revalidate every 2 hours
    };
  } catch (error) {
    console.error("Error fetching ratings pages:", error);

    return {
      props: {
        ratingsPages: superjson.serialize([]),
      },
      revalidate: 300, // Retry in 5 minutes on error
    };
  }
}

export default RatingsIndex;
