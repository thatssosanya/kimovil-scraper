import Head from "next/head";
import { CatalogueTable } from "@/src/components/dashboard/common/CatalogueTable/CatalogueTable";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { db } from "@/src/server/db";
import { type InferGetStaticPropsType } from "next";

type CatalogueProps = InferGetStaticPropsType<typeof getStaticProps>;

const Home = ({ widgets }: CatalogueProps) => {
  const showOldVersion = false; // Toggle this to show old version

  return (
    <>
      <Head>
        <title>Каталог</title>
        <meta name="description" content="Каталог палача" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main id="main" className="mx-auto h-full bg-zinc-100 dark:bg-zinc-900">
        <SiteHeader />

        {showOldVersion ? (
          <CatalogueTable widgets={widgets} />
        ) : (
          <div className="container mx-auto px-4 py-16">
            <div className="border-primary/30 from-primary/5 to-primary/15 mx-auto max-w-3xl rounded-lg border bg-gradient-to-r p-8 text-center shadow-sm">
              <h1 className="text-foreground mb-6 text-3xl font-bold sm:text-4xl md:text-5xl">
                Страница в разработке
              </h1>
              <p className="text-muted-foreground mb-8 text-xl">
                Мы работаем над обновлением каталога и скоро запустим новую
                улучшенную версию.
              </p>
              <div className="bg-primary/10 mx-auto mt-8 w-full max-w-lg rounded-lg p-4">
                <p className="text-primary text-lg font-medium">
                  Следите за обновлениями!
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export async function getStaticProps() {
  // Get widgets with all related data using Drizzle query relations
  const widgetsWithRelations = await db.query.widget.findMany({
    with: {
      type: true,
      devices: {
        with: {
          configs: {
            with: {
              config: true,
            },
          },
          links: {
            with: {
              marketplace: true,
              config: true,
            },
          },
          ratingPositions: true,
        },
      },
      categories: {
        with: {
          category: true,
        },
      },
      tags: {
        with: {
          tag: true,
        },
      },
    },
  });

  // Transform the data to match CatalogueTable's expected structure
  const transformedWidgets = widgetsWithRelations.map((widget) => ({
    id: widget.id,
    name: widget.name,
    widgetTypeId: widget.widgetTypeId,
    devices: widget.devices.map((device) => ({
      device: device,
    })),
  }));

  // Serialize dates for Next.js
  const serializedWidgets = JSON.stringify(transformedWidgets);
  const parsedWidgets = JSON.parse(serializedWidgets) || [];

  return {
    props: {
      widgets: parsedWidgets,
    },
    revalidate: 2,
  };
}

export default Home;
