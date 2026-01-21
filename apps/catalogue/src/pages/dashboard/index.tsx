import { type NextPage } from "next";
import Head from "next/head";
import Layout from "@/src/components/dashboard/layout/Layout";
import DashboardWidgets from "@/src/components/dashboard/widgets/DashboardWidgets";
import { useHeaderActions } from "@/src/hooks/useHeaderActions";

const Home: NextPage = () => {
  useHeaderActions({
    title: "Обзор",
  });

  return (
    <>
      <Head>
        <title>Палач | Панель управления</title>
        <meta name="description" content="Dashboard overview" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main id="main" className="mx-auto h-full bg-gray-100/80 dark:bg-[hsl(0_0%_7%)]">
        <Layout contentScrollable={true}>
          <DashboardWidgets />
        </Layout>
      </main>
    </>
  );
};

export default Home;
