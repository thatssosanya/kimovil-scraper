import React from "react";
import { type DeviceWithConfigs } from "../types";
import { type LinkWithRelations } from "@/src/components/dashboard/link/components/LinkCard";
import { AddLinkDialogue } from "@/src/components/dashboard/link/components/dialogs/AddLinkDialogue";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import { Droppable } from "@/src/components/dashboard/common/Droppable";
import { LinkCard } from "@/src/components/dashboard/link/components";
import { extractDigits } from "@/src/utils/utils";
import { useLinkConfigs } from "../hooks/useLinkConfigs";
import { api } from "@/src/utils/api";
import { LinkConfigManager } from "@/src/components/dashboard/link/components";

type LinksSectionProps = {
  device: DeviceWithConfigs;
};

export const LinksSection = ({ device }: LinksSectionProps) => {
  const utils = api.useUtils();
  const {
    isDragging,
    pendingLinks,
    handleDragStart,
    handleDragEnd,
    handleSaveChanges,
    handleResetChanges,
    getFilteredLinks,
  } = useLinkConfigs(device.id);

  const deleteLinkMutation = api.link.deleteLink.useMutation({
    onSuccess: () => {
      void utils.link.getDeviceLinks.invalidate({ id: device.id });
    },
  });
  const [configModalLink, setConfigModalLink] =
    React.useState<LinkWithRelations | null>(null);
  const { data: deviceCharacteristics } =
    api.device.getDeviceCharacteristic.useQuery(
      { deviceId: device.id },
      { enabled: !!device.id }
    );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const hasPendingChanges = Object.keys(pendingLinks).length > 0;

  return (
    <div className="flex flex-col gap-1 px-4 pb-12">
      <div className="flex items-center justify-between py-2">
        <div className="text-xl font-bold">Ссылки</div>
        <div className="flex items-center gap-2">
          {hasPendingChanges && (
            <>
              <button
                onClick={handleResetChanges}
                className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Сбросить
              </button>
              <button
                onClick={() => void handleSaveChanges()}
                className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
              >
                Сохранить изменения
              </button>
            </>
          )}
          <AddLinkDialogue deviceId={device.id} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="rounded-lg border bg-white">
          <div className="grid grid-cols-[200px,1fr] divide-y">
            {device.configs
              ?.sort(
                (b, a) =>
                  parseInt(a.capacity || extractDigits(a.name).toString()) -
                  parseInt(b.capacity || extractDigits(b.name).toString())
              )
              .map((config) => {
                const configLinks = getFilteredLinks(config.id);
                return (
                  <React.Fragment key={config.id}>
                    <div className="flex items-center gap-2 border-r bg-zinc-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{config.name}</div>
                      </div>
                      <AddLinkDialogue
                        configId={config.id}
                        deviceId={device.id}
                        variant="ghost"
                        size="sm"
                      />
                    </div>
                    <Droppable id={config.id}>
                      <div className="min-h-[100px] p-2">
                        {configLinks?.length ? (
                          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                            {configLinks.map((link) => (
                              <LinkCard
                                key={link.id}
                                link={link}
                                onDelete={(id) =>
                                  deleteLinkMutation.mutate({ id })
                                }
                                onConfigure={(link) => setConfigModalLink(link)}
                                isDragging={isDragging}
                                isPending={link.id in pendingLinks}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="flex h-full min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                            <div className="text-center text-sm text-zinc-500">
                              Перетащите ссылки сюда
                            </div>
                          </div>
                        )}
                      </div>
                    </Droppable>
                  </React.Fragment>
                );
              })}
            <div className="flex items-center gap-2 border-r bg-zinc-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="font-medium">.</div>
              </div>
              <AddLinkDialogue deviceId={device.id} variant="ghost" size="sm" />
            </div>
            <Droppable id="no-config">
              <div className="min-h-[100px] p-2">
                {getFilteredLinks(null)?.length ? (
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {getFilteredLinks(null)?.map((link) => (
                      <LinkCard
                        key={link.id}
                        link={link}
                        onDelete={(id) => deleteLinkMutation.mutate({ id })}
                        onConfigure={(link) => setConfigModalLink(link)}
                        isDragging={isDragging}
                        isPending={link.id in pendingLinks}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[100px] items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                    <div className="text-center text-sm text-zinc-500">
                      Перетащите ссылки сюда
                    </div>
                  </div>
                )}
              </div>
            </Droppable>
          </div>
        </div>
      </DndContext>

      {configModalLink && (
        <div className="fixed inset-0 z-50 rounded-lg border border-zinc-200 bg-black/40 p-6 backdrop:bg-black/50">
          <dialog
            className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 p-6 backdrop:bg-black/50"
            open
            onClose={() => setConfigModalLink(null)}
          >
            <div className="w-[600px]">
              <LinkConfigManager
                link={configModalLink}
                configs={device.configs}
                deviceId={device.id}
                skus={deviceCharacteristics?.skus}
                onUpdate={() => setConfigModalLink(null)}
                onClose={() => setConfigModalLink(null)}
              />
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
};
