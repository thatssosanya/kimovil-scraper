import { api } from "@/src/utils/api";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import React from "react";

type LinkPopoverProps = {
  deviceId: string;
  configId: string;
};

const LinkPopover = ({ deviceId, configId }: LinkPopoverProps) => {
  const { data: links } = api.link.getDeviceLinks.useQuery({
    id: deviceId,
  });

  return (
    <div className="flex flex-col gap-2">
      {links
        ?.filter((l) => {
          return l.config?.id === configId;
        })
        .map((el) => (
          <div className="flex items-center gap-4" key={el.id}>
            <img
              className="h-6 w-6 rounded"
              src={el.marketplace?.iconUrl || ""}
              alt=""
            />
            <div className="w-[60px] text-right text-xs font-medium">
              {rubleCurrencyFormatter(el.price)}
            </div>
            <a
              href={el.url || ""}
              title={el.url || ""}
              className="ml-auto font-mono text-xs hover:text-primary "
            >
              {el.url?.slice(0, 18)}...
            </a>
          </div>
        ))}
    </div>
  );
};

export default LinkPopover;
