import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/src/utils/api";
import {
  type ParsedUrl,
  PARTNER_CLIDS,
  type PartnerType,
} from "../utils/link-utils";

export function useLinkGenerator(parsedUrl: ParsedUrl | null) {
  const [vid, setVid] = useState("catalogue");
  const [customVid, setCustomVid] = useState("");
  const [isCustomVid, setIsCustomVid] = useState(false);

  const createPartnerLink = api.link.createPartnerLink.useMutation({
    onSuccess: (data) => {
      if (data.link) {
        void navigator.clipboard.writeText(data.link.shortUrl);
        toast.success("Короткая ссылка скопирована");
      }
    },
    onError: (error) => {
      toast.error("Ошибка при создании ссылки", {
        description: error.message,
      });
    },
  });

  const generatePartnerLink = (type: PartnerType) => {
    if (!parsedUrl) return;

    const selectedVid = isCustomVid ? customVid : vid;
    if (!selectedVid) {
      toast.error("Выберите VID");
      return;
    }
    const clid = PARTNER_CLIDS[type];

    createPartnerLink.mutate({
      url: parsedUrl.origin + parsedUrl.pathname + parsedUrl.search,
      clid,
      vid: selectedVid,
    });
  };

  const reset = () => {
    setVid("catalogue");
    setCustomVid("");
    setIsCustomVid(false);
  };

  return {
    vid,
    setVid,
    customVid,
    setCustomVid,
    isCustomVid,
    setIsCustomVid,
    generatedLink: createPartnerLink.data?.link,
    isLoading: createPartnerLink.isPending,
    generatePartnerLink,
    reset,
  };
}
