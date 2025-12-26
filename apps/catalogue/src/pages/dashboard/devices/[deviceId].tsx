import { type NextPage } from "next";
import { useRouter } from "next/router";
import { api } from "@/src/utils/api";
import Layout from "@/src/components/dashboard/layout/Layout";
import { DeviceProfile } from "@/src/components/dashboard/device/profile";
import { Button } from "@/src/components/ui/Button";
import { ArrowLeft } from "lucide-react";
import { useHeaderActions } from "@/src/hooks/useHeaderActions";
import { EditDeviceDialogue } from "@/src/components/dashboard/device/dialogs/EditDeviceDialogue";

import { ExternalLink, RefreshCcw } from "lucide-react";
import { revalidateDevicePage } from "@/src/utils/revalidate";
import { toast } from "sonner";

const DeviceDetailsPage: NextPage = () => {
  const router = useRouter();
  const { deviceId } = router.query;

  const { data: device, isPending } = api.device.getDevice.useQuery(
    {
      deviceId: typeof deviceId === "string" ? deviceId : null,
    },
    {
      enabled: typeof deviceId === "string" && deviceId !== "",
      retry: false,
    }
  );

  // profile slug for public link and cache refresh
  const { data: profileData } = api.device.getDeviceCharacteristic.useQuery(
    { deviceId: typeof deviceId === "string" ? deviceId : "" },
    { enabled: typeof deviceId === "string" && deviceId !== "" }
  );

  const handleBack = () => {
    void router.push("/dashboard/devices");
  };

  // Header integration
  useHeaderActions({
    title: device?.name || "Устройство",
    leftActions: [
      <Button key="back" variant="ghost" size="sm" className="h-8 gap-1.5 text-gray-900 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-gray-800/60" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Назад</span>
      </Button>,
    ],
    rightActions: [
      device ? (
        <EditDeviceDialogue
          key="edit"
          device={device}
          variant="ghost"
          size="icon"
          iconOnly
          className="h-8 w-8 text-gray-900 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-gray-800/60"
        />
      ) : null,

      profileData?.slug ? (
        <Button
          key="public"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-gray-900 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-gray-800/60"
          asChild
        >
          <a href={`/devices/${profileData.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Профиль</span>
          </a>
        </Button>
      ) : null,
      profileData?.slug ? (
        <Button
          key="refresh"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-gray-900 hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-gray-800/60"
          onClick={async () => {
            await revalidateDevicePage(profileData.slug!);
            toast.success("Кэш страницы профиля обновлен");
          }}
          title="Обновить кэш"
          aria-label="Обновить кэш"
        >
          <RefreshCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Обновить</span>
        </Button>
      ) : null,
    ].filter(Boolean) as React.ReactNode[],
  });

  if (isPending) {
    return (
      <Layout>
        <div className="flex h-full w-full items-center justify-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  if (!device) {
    return (
      <Layout>
        <div className="flex h-full w-full flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-semibold">Device not found</h1>
          <Button onClick={handleBack}>Go back to devices</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full w-full">
        <DeviceProfile deviceId={deviceId as string} />
      </div>
    </Layout>
  );
};

export default DeviceDetailsPage;
