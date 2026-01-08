import { type NextPage } from "next";
import { useRouter } from "next/router";
import { PreviewDevicePage } from "@/src/components/public/device/PreviewDevicePage";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import SiteHeader from "@/src/components/public/layout/SiteHeader";
import { Breadcrumbs } from "@/src/components/ui/Breadcrumbs";

const PreviewDevicePageRoute: NextPage = () => {
  const router = useRouter();
  const slug = router.query.slug as string | undefined;

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      void router.push("/dashboard");
    }
  };

  if (!slug) {
    return null;
  }

  return (
    <>
      <SignedIn>
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
                { label: "Предпросмотр", href: "/preview/devices" },
                { label: slug, href: `/preview/devices/${slug}` },
              ]}
            />
            <button
              onClick={handleBack}
              className="hover:text-primary -mb-8 flex text-sm font-medium text-black transition-colors dark:text-gray-400 dark:hover:text-white"
            >
              ← Вернуться назад
            </button>
            <PreviewDevicePage slug={slug} />
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default PreviewDevicePageRoute;
