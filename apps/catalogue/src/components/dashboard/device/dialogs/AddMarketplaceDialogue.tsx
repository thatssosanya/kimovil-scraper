import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { Input } from "@/src/components/ui/Input";
import { Field, Form } from "houseform";
import { z } from "zod";
import { PlusIcon } from "@heroicons/react/24/outline";
import { api } from "@/src/utils/api";
import type { Marketplace } from "@/src/server/db/schema";

export const AddMarketplaceDialogue = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const utils = api.useUtils();

  const { mutateAsync: createMarketplace } =
    api.config.createMarketplace.useMutation({
      onSuccess: async () => {
        await utils.config.getAllMarketplaces.refetch();
      },
    });
  const handleCreateMarketplace = useCallback(
    async (e: Marketplace) => {
      await createMarketplace({
        name: e.name || "",
        baseUrl: e.baseUrl || "",
        iconUrl: e.iconUrl || "",
      });
    },
    [createMarketplace]
  );
  return (
    <Dialog open={createModalOpen} modal>
      <DialogTrigger
        onClick={() => setCreateModalOpen(true)}
        className="mx-auto my-4 flex w-max items-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 shadow-sm transition hover:bg-zinc-100"
      >
        <div>Добавить</div>

        <PlusIcon strokeWidth={2} className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent onInteractOutside={() => setCreateModalOpen(false)}>
        <DialogHeader>
          <DialogTitle>Добавить виджет</DialogTitle>
          <DialogDescription>
            <div>
              <Form
                onSubmit={(e: Marketplace) => {
                  handleCreateMarketplace(e)
                    .then(() => {
                      setCreateModalOpen(false);
                    })
                    .catch((e) => {
                      console.log(e);
                    });

                  return;
                }}
              >
                {({ submit }) => (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit().catch((e) => {
                        console.log(e);
                      });
                    }}
                    className="flex flex-col gap-4 py-4"
                    action=""
                  >
                    <Field
                      name="name"
                      onMountValidate={z.string()}
                      onBlurValidate={z.string()}
                    >
                      {({ value, setValue }) => (
                        <Input
                          value={value as string}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="Название"
                        />
                      )}
                    </Field>
                    <Field
                      name="baseUrl"
                      onMountValidate={z.string()}
                      onBlurValidate={z.string().url()}
                    >
                      {({ value, setValue }) => (
                        <Input
                          value={value as string}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder="Ссылка площадки"
                        />
                      )}
                    </Field>
                    <Field
                      name="iconUrl"
                      onMountValidate={z.string()}
                      onBlurValidate={z.string().url("Неверный URL иконки")}
                    >
                      {({ value, setValue, errors }) => (
                        <>
                          {errors.length > 0 && (
                            <span className="rounded bg-red-50 px-2 py-1 text-xs text-zinc-600">
                              {errors[0]}
                            </span>
                          )}
                          <img
                            className="obj h-12 w-12"
                            src={value as string}
                            alt=""
                          />
                          <Input
                            value={value as string}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Иконка"
                          />
                        </>
                      )}
                    </Field>

                    <button type="submit">Сохранить</button>
                  </form>
                )}
              </Form>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
