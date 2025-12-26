import React, { useState } from "react";
import { TwoColumns } from "@/src/components/dashboard/layout";
import Layout from "@/src/components/dashboard/layout/Layout";
import { api } from "@/src/utils/api";
import { LinkList } from "@/src/components/dashboard/link/components";
import type { Link } from "@/src/server/db/schema";

const SmartphonesView = () => {
  const utils = api.useUtils();

  const { mutateAsync: deleteLink } = api.link.deleteLink.useMutation({
    onSuccess: async () => {
      await utils.link.getAllLinks.refetch();
    },
  });
  const [selectedLink, setSelectedLink] = useState<Link>();

  return (
    <Layout>
      <TwoColumns>
        <div className="scrollbar flex h-full flex-col overflow-auto bg-white ">
          <LinkList
            selectedLink={selectedLink}
            setSelectedLink={setSelectedLink}
          />
        </div>
        <div>
          {/* <DeviceView selectedLink={selectedLink} device={selectedDevice} /> */}
        </div>
        <div className=" hidden px-16 py-8">
          {selectedLink?.id && (
            <div>
              <div className="text-xl font-bold">
                {selectedLink && selectedLink.name}
              </div>
              <div className="text-lg font-bold">
                {selectedLink && selectedLink.price}
              </div>
              {/* <div className="text-lg font-bold">
                {selectedLink && selectedLink.marketplace}
              </div> */}
              <div
                className="flex w-max cursor-pointer rounded border px-2 py-1 hover:bg-zinc-100"
                onClick={() => {
                  if (selectedLink?.id) {
                    void (async () => {
                      try {
                        await deleteLink({ id: selectedLink.id });
                        setSelectedLink(undefined);
                      } catch (e) {
                        console.log(e);
                      }
                    })();
                  }
                }}
              >
                Удалить
              </div>
            </div>
          )}
        </div>
      </TwoColumns>
    </Layout>
  );
};

export default SmartphonesView;
