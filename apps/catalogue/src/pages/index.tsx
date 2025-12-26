import Head from "next/head";
import { SignedIn, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Link from "next/link";
import { Star, ArrowRight, Smartphone, TrendingUp } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { db } from "@/src/server/db";
import { deviceCharacteristics, rating, ratingsPage } from "@/src/server/db/schema";
import { eq, asc, count } from "drizzle-orm";
import { PUBLISH_STATUS } from "@/src/constants/publishStatus";
import { formatCount, PLURALS } from "@/src/utils/pluralize";

type RatingsPageItem = {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  description: string | null;
};

type HomeProps = {
  stats: {
    devicesCount: number;
    ratingsCount: number;
  };
  ratingsPages: RatingsPageItem[];
};

const Home = ({ stats, ratingsPages }: HomeProps) => {
  const { user } = useUser();

  const userName =
    user?.firstName ??
    user?.fullName ??
    user?.username ??
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    "Пользователь";

  return (
    <>
      <Head>
        <title>
          Рейтинги лучших устройств 2025 — Палач | Честные обзоры и сравнения
        </title>
        <meta
          name="description"
          content={`Рейтинги лучших устройств 2025 года. ${stats.devicesCount} проверенных устройств, ${stats.ratingsCount} актуальных рейтингов. Выбирайте идеальные смартфоны, планшеты, ноутбуки по цене и характеристикам. Честные обзоры, реальные цены.`}
        />
        <meta
          name="keywords"
          content="рейтинги смартфонов 2025, лучшие телефоны, рейтинг телефонов, смартфоны по цене, обзоры телефонов, какой телефон купить, лучшие андроид, айфон рейтинг, сравнение смартфонов"
        />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta
          property="og:title"
          content="Рейтинги лучших устройств 2025 — Палач"
        />
        <meta
          property="og:description"
          content={`${stats.devicesCount} проверенных устройств в ${stats.ratingsCount} актуальных рейтингах. Выбирайте идеальные смартфоны, планшеты, ноутбуки по цене и характеристикам.`}
        />
        <meta property="og:url" content="https://c.click-or-die.ru" />
        <meta property="og:site_name" content="Палач" />
        <meta property="og:locale" content="ru_RU" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Рейтинги лучших устройств 2025 — Палач"
        />
        <meta
          name="twitter:description"
          content={`${stats.devicesCount} проверенных устройств в ${stats.ratingsCount} актуальных рейтингах.`}
        />

        {/* Additional SEO */}
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <meta name="googlebot" content="index, follow" />
        <meta name="revisit-after" content="1 day" />
        <meta name="author" content="Палач" />
        <meta name="language" content="ru" />
        <meta name="geo.region" content="RU" />
        <meta name="geo.country" content="Russia" />

        <link rel="icon" href="/favicon.ico" />
        <link rel="canonical" href="https://c.click-or-die.ru" />

        {/* Structured Data - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Палач",
              url: "https://click-or-die.ru",
              logo: "https://click-or-die.ru/logo.png",
              description: "Рейтинги и обзоры лучших смартфонов",
              sameAs: ["https://t.me/clickordie"],
            }),
          }}
        />

        {/* Structured Data - Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Палач — Рейтинги смартфонов",
              url: "https://click-or-die.ru",
              description: `Рейтинги лучших смартфонов 2025 года. ${stats.devicesCount} проверенных устройств в ${stats.ratingsCount} актуальных рейтингах.`,
              potentialAction: {
                "@type": "SearchAction",
                target:
                  "https://click-or-die.ru/devices?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </Head>

      <SiteHeader />
      <main className="min-h-screen bg-white dark:bg-gray-900">
        <div className="mx-auto px-4 py-4 pb-16 xl:container">
          {/* Hero Section - matching ratings page style */}
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-900 dark:text-white md:text-5xl">
            Рейтинги лучших устройств 2025
          </h1>

          {/* Description */}
          <p className="mt-3 max-w-2xl text-lg text-gray-500 dark:text-gray-400">
            {stats.devicesCount} устройств в {stats.ratingsCount} рейтингах с актуальными ценами
          </p>

          {/* Quick Stats */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-1.5">
              <Smartphone className="text-primary h-4 w-4" />
              <span>{formatCount(stats.devicesCount, PLURALS.devices)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-yellow-500" />
              <span>{formatCount(stats.ratingsCount, PLURALS.ratings)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>Ежедневные обновления</span>
            </div>
          </div>

          {/* Main Content - Two Columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-10"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Ratings Column */}
              <div>
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  Рейтинги
                </h2>

                <div className="space-y-2">
                  {ratingsPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/ratings/${page.slug}`}
                      className="group block"
                    >
                      <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                        {page.iconName ? (
                          <DynamicIcon
                            name={page.iconName as "replace"}
                            className="text-primary h-5 w-5"
                            fallback={() => (
                              <Star className="text-primary h-5 w-5" />
                            )}
                          />
                        ) : (
                          <Star className="text-primary h-5 w-5" />
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {page.name}
                          </h3>
                          {page.description && (
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                              {page.description}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Catalogue Column */}
              <div>
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  Каталог
                </h2>

                <div className="space-y-2">
                  <Link href="/devices" className="group block">
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 transition-colors duration-200 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                      <Smartphone className="text-primary h-5 w-5" />
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          Каталог смартфонов
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                          Полный каталог с характеристиками и ценами
                        </p>
                      </div>
                      <ArrowRight className="text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Admin Panel Link for Signed In Users */}
          <SignedIn>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6"
            >
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Добро пожаловать, {userName}!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    У вас есть доступ к панели управления
                  </p>
                </div>
                <Link
                  href="/dashboard"
                  className="bg-primary hover:bg-primary/90 rounded-full px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Панель управления
                </Link>
              </div>
            </motion.div>
          </SignedIn>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12"
          >
            <h2 className="mb-4 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              Преимущества
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <Star className="text-primary mb-2 h-5 w-5" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Экспертные оценки
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Профессиональное тестирование устройств
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <TrendingUp className="mb-2 h-5 w-5 text-green-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Актуальные цены
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Ежедневное обновление из магазинов
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <Smartphone className="text-primary mb-2 h-5 w-5" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Детальные сравнения
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Полные характеристики и оценки
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                <Star className="mb-2 h-5 w-5 text-yellow-500" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Новинки первыми
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Свежая информация о новых устройствах
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
};

const REVALIDATE_TIME = {
  HOUR: 60 * 60,
  FIVE_MINUTES: 300,
} as const;

const _PUBLISHED_STATUS_FILTER = { status: PUBLISH_STATUS.PUBLISHED } as const;

export async function getStaticProps() {
  try {
    const [devicesCountResult, ratingsCountResult, ratingsPages] = await Promise.all([
      db
        .select({ value: count() })
        .from(deviceCharacteristics)
        .where(eq(deviceCharacteristics.status, PUBLISH_STATUS.PUBLISHED)),
      db
        .select({ value: count() })
        .from(rating)
        .where(eq(rating.status, PUBLISH_STATUS.PUBLISHED)),
      db
        .select({
          id: ratingsPage.id,
          name: ratingsPage.name,
          slug: ratingsPage.slug,
          iconName: ratingsPage.iconName,
          description: ratingsPage.description,
        })
        .from(ratingsPage)
        .where(eq(ratingsPage.status, PUBLISH_STATUS.PUBLISHED))
        .orderBy(asc(ratingsPage.position)),
    ]);

    const devicesCount = devicesCountResult[0]?.value ?? 0;
    const ratingsCount = ratingsCountResult[0]?.value ?? 0;

    return {
      props: {
        stats: { devicesCount, ratingsCount },
        ratingsPages,
      },
      revalidate: REVALIDATE_TIME.HOUR,
    };
  } catch (error) {
    console.error("Error fetching homepage data:", error);

    return {
      props: {
        stats: { devicesCount: 0, ratingsCount: 0 },
        ratingsPages: [],
      },
      revalidate: REVALIDATE_TIME.FIVE_MINUTES,
    };
  }
}

export default Home;
