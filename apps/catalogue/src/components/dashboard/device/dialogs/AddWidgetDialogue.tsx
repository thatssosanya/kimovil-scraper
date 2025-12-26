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
import type { Widget } from "@/src/server/db/schema";
import { Button } from "@/src/components/ui/Button";

export const AddWidgetDialogue = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const utils = api.useUtils();

  const { mutateAsync: createWidget } = api.widget.createWidget.useMutation({
    onSuccess: async () => {
      await utils.widget.getAllWidgets.refetch();
    },
  });
  const handleCreateWidget = useCallback(
    async (e: Widget) => {
      await createWidget({
        name: e.name || "",
      });
    },
    [createWidget]
  );
  return (
    <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen} modal>
      <DialogTrigger
        onClick={() => setCreateModalOpen(true)}
        className="mx-auto my-4 flex max-w-3xl items-center gap-2 rounded border border-zinc-300 bg-white px-4 py-2 shadow-sm transition hover:bg-zinc-100"
      >
        <div>Добавить</div>

        <PlusIcon strokeWidth={2} className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent
        className="w-96"
        onInteractOutside={() => setCreateModalOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Добавить виджет</DialogTitle>
          <DialogDescription>
            <div className="grid grid-cols-3">
              <div className="col-span-3">
                <Form
                  onSubmit={(e: Widget) => {
                    handleCreateWidget(e)
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
                      className="flex flex-col gap-4 pt-4"
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

                      <Button type="submit">Сохранить</Button>
                    </form>
                  )}
                </Form>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
