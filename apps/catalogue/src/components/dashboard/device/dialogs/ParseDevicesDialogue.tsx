import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { type FormInstance } from "houseform";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "@uppy/image-editor/dist/style.min.css";
import Image from "next/image";
import ym from "@/src/assets/images/ym.png";
import {
  checkCapacityInName,
  extractDigits,
  type PhoneModel,
} from "@/src/utils/utils";
import {
  CheckCircle2Icon,
  CircleIcon,
  LucideHardDriveDownload,
  LucideSmartphone,
} from "lucide-react";
import { api } from "@/src/utils/api";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Button } from "@/src/components/ui/Button";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { type DeviceWithConfigs } from "@/src/components/dashboard/device/views/types";

export type DeviceFormInstance = FormInstance<{
  name: string;
  configs: string[];
  type: string;
  id: string;
  yandexId: string;
  imageUrl: string;
}>;

type ConfigLinks = {
  config: DeviceWithConfigs["configs"][0];
  linkIds: string[];
}[];

export const ParseDeviceDialogue = (props: { device: DeviceWithConfigs }) => {
  const { device } = props;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const utils = api.useUtils();

  const [configLinks, setConfigLinks] = useState<ConfigLinks>(
    device.configs.map((config) => ({ config: config, linkIds: [] }))
  );
  const { data: allMarketplaces } = api.config.getAllMarketplaces.useQuery();

  const { mutate: createLinks, isPending } = api.link.createLinks.useMutation({
    onSuccess: () => {
      setCreateModalOpen(false);
      utils.link.getDeviceLinks
        .refetch({
          id: device.id,
        })
        .then()
        .catch((err) => console.log(err));
    },
  });
  const handleSubmitLinks = (
    devices: UseQueryResult<PhoneModel[], unknown>
  ) => {
    const marketplace = allMarketplaces?.find(
      (el) => el.name === "Яндекс.Дистрибуция"
    );
    if (!marketplace) {
      throw new Error("No marketplace found");
    }
    const links = selectedIds.map((id) => {
      const device = devices.data?.find((el) => el.id === id);
      if (!device) {
        throw new Error("No device found");
      }
      return {
        config:
          configLinks.find((config) => config.linkIds.includes(id))?.config
            .id || "",
        price: extractDigits(device.price),
        url: device.link,
        name: device.title,
      };
    });
    createLinks({
      marketplace: marketplace.id,
      device: device.id,
      links,
    });
  };

  const devices = useQuery({
    queryKey: [`parseDevice-${device.yandexId || ""}`],
    enabled: false,
    queryFn: async () =>
      await fetch("http://localhost:3001/parse_device", {
        method: "POST",
        body: JSON.stringify({
          name: device.name,
          id: device.yandexId || "0",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then(async (res) => {
        const array = (await res.json()) as { devices: Array<PhoneModel> };
        return array.devices;
      }),
  });

  useEffect(() => {
    setConfigLinks(
      device.configs.map((config) => ({ config: config, linkIds: [] }))
    );
    setSelectedIds([]);
  }, [device.configs]);

  const deviceSelectHandler = (el: PhoneModel) => {
    if (selectedIds.includes(el.id)) {
      setSelectedIds(selectedIds.filter((phone) => phone !== el.id));
      device.configs.forEach((config) => {
        if (el.title && checkCapacityInName(config.name, el.title)) {
          const newConfigLinks = configLinks.map((link) => {
            if (link.config.id === config.id) {
              return {
                config: link.config,
                linkIds: link.linkIds.filter((id) => id !== el.id),
              };
            }
            return link;
          });
          setConfigLinks(newConfigLinks);
        }
      });
    } else {
      setSelectedIds([...selectedIds, el.id]);
      device.configs.forEach((config) => {
        if (el.title && checkCapacityInName(config.name, el.title)) {
          const newConfigLinks = configLinks.map((link) => {
            if (link.config.id === config.id) {
              return {
                config: link.config,
                linkIds: [...link.linkIds, el.id],
              };
            }
            return link;
          });
          setConfigLinks(newConfigLinks);
        }
      });
    }
  };

  return (
    <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen} modal>
      <DialogTrigger
        onClick={() => setCreateModalOpen(true)}
        className="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber-600 transition-colors hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <div>Спарсить маркет</div>
        <Image className="h-4 w-4 drop-shadow-sm" src={ym} alt="market" />
      </DialogTrigger>

      <DialogContent
        className="flex min-h-[70%] max-w-full flex-col  "
        onInteractOutside={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // if (!formRef.current?.isDirty) {
          //   setCreateModalOpen(false);
          // }
        }}
      >
        <div className="flex flex-col">
          <DialogTitle className=" text-2xl">
            Поиск на Яндекс.Маркете
          </DialogTitle>
          {!device.yandexId && (
            <span className="flex items-center gap-2 rounded bg-red-50 px-2 py-1 text-red-600">
              <ExclamationCircleIcon className="h-4 w-4" />
              Отсутствует YandexId, спарсить не получится
            </span>
          )}
          <Button
            className="hover:border-primaryHighlight hover:bg-primary group mt-2 flex w-max cursor-pointer gap-2 rounded border border-zinc-400  bg-zinc-100 px-2 font-bold hover:text-white"
            disabled={!device.yandexId || devices.isFetching}
            variant="default"
            size="sm"
            onClick={() => {
              devices
                .refetch()
                .then()
                .catch((err) => console.log(err));
            }}
          >
            <LucideHardDriveDownload />
            <div className="flex flex-col items-start justify-start">
              <div>Найти актуальные цены {device.name}</div>
              {device.yandexId && (
                <div className="text-xs font-medium ">
                  ID: {device.yandexId}
                </div>
              )}
            </div>
          </Button>
          {devices.isFetching && (
            <div className="animate-pulse">Загрузка...</div>
          )}
        </div>
        <div className=" flex flex-1 flex-col gap-4 ">
          <div className="scrollbar flex-0 flex max-h-[500px] max-w-full flex-col overflow-y-auto whitespace-break-spaces">
            {devices.data && (
              <div className="px-2 py-2 text-lg font-medium">
                Найдено {devices.data.length} цен на Яндекс.Маркете
              </div>
            )}
            {devices?.data
              ?.filter((el) => el)
              .sort((a, b) => extractDigits(a.price) - extractDigits(b.price))
              .map((el) => (
                <div
                  className="flex cursor-pointer select-none items-center gap-2 rounded px-2 py-2 transition hover:bg-zinc-100"
                  onClick={() => deviceSelectHandler(el)}
                  key={el.id}
                >
                  {selectedIds.includes(el.id) ? (
                    <CheckCircle2Icon className="h-6 w-6 stroke-zinc-600 stroke-2" />
                  ) : (
                    <CircleIcon className="h-6 w-6 stroke-zinc-500 stroke-1" />
                  )}
                  <div>{el?.title || ""}</div>
                  <div className="ml-auto flex flex-shrink-0 flex-col items-end justify-end text-sm">
                    <div>
                      {device.configs.map((config) => (
                        <>
                          {el.title &&
                            checkCapacityInName(config.name, el.title) && (
                              <div
                                className="rounded border border-zinc-400 bg-zinc-200 px-1 py-0.5"
                                key={config.id}
                              >
                                <div className="font-mono text-xs">
                                  {config.name}
                                </div>
                              </div>
                            )}
                        </>
                      ))}
                    </div>
                    <div className="font-bold">{el?.price}</div>
                    {el?.discount && (
                      <div className="text-xs">
                        <span className="pr-2 line-through">
                          {el?.originalPrice}
                        </span>
                        {el?.discount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
          {selectedIds.length === 0 && (
            <div className="mx-auto mt-auto flex items-center gap-2 text-sm text-zinc-700">
              <LucideSmartphone className="h-6 w-6" />
              <div>Выберите цены для добавления в каталог</div>
            </div>
          )}
          {selectedIds.length > 0 && (
            <>
              <div className="mx-auto mt-auto flex min-h-[128px] flex-col gap-2 rounded border border-zinc-200 bg-zinc-100 px-4 py-2">
                <div className="mx-auto text-sm font-medium text-zinc-700">
                  Выбранные конфигурации
                </div>
                <div className="flex gap-8 overflow-y-auto">
                  {device.configs.map((el) => (
                    <div key={el.id}>
                      <div className="mb-1 w-max rounded border border-zinc-400 bg-zinc-200 px-1 py-0.5 font-mono text-xs">
                        {el.name}
                      </div>
                      <div>
                        {configLinks
                          .find((config) => config.config.id === el.id)
                          ?.linkIds.map((id) => (
                            <div className="font-sans text-sm" key={id}>
                              {
                                devices.data
                                  ?.filter((el) => el)
                                  .find((el) => el.id === id)?.price
                              }
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="default"
                onClick={() => {
                  handleSubmitLinks(devices);
                }}
              >
                <div>Добавить {selectedIds.length} штуки</div>
                {isPending && <div className="animate-spin">Загрузка...</div>}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
