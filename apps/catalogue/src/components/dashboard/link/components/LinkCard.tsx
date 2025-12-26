import React, { useState, useEffect, useRef } from "react";
import type { Link, Config, Sku, Marketplace } from "@/src/server/db/schema";
import {
  Settings,
  Trash2,
  GripVertical,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  Link as LinkIcon,
  CheckCircle,
  Pencil,
} from "lucide-react";
import { formatRelativeTime, rubleCurrencyFormatter } from "@/src/utils/utils";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/utils/api";
import { motion, AnimatePresence } from "framer-motion";

export type LinkWithRelations = Link & {
  marketplace?: Marketplace | null;
  config?: Config | null;
  sku?: Omit<Sku, "createdAt" | "updatedAt"> | null;
};

interface LinkCardProps {
  link: LinkWithRelations;
  onDelete: (id: string) => void;
  onConfigure: (link: LinkWithRelations) => void;
  isDragging: boolean;
  isPending: boolean;
}

const getAgeStyle = (date: Date) => {
  const days = (new Date().getTime() - date.getTime()) / (1000 * 3600 * 24);

  if (days >= 60) return "very-old";
  if (days >= 40) return "old";
  if (days >= 20) return "aging";
  return "fresh";
};

const getHostStyle = (url: string | null) => {
  if (!url) return null;

  try {
    const host = new URL(url).host;

    if (host === "ya.cc" || host === "clck.ru") {
      return {
        bg: "bg-[#FFE5E5]",
        text: "text-[#B91C1C]",
        ring: "ring-[#FECACA]",
      };
    }
    if (host === "kik.kat") {
      return {
        bg: "bg-[#E6F6E6]",
        text: "text-[#15803D]",
        ring: "ring-[#BBF7D0]",
      };
    }
    if (host === "market.yandex.ru") {
      return {
        bg: "bg-[#FFF4E6]",
        text: "text-[#C2410C]",
        ring: "ring-[#FED7AA]",
      };
    }
    if (host === "yandex.market") {
      return {
        bg: "bg-[#E6F0FF]",
        text: "text-[#1E40AF]",
        ring: "ring-[#BFDBFE]",
      };
    }

    return null;
  } catch {
    return null;
  }
};

const getHostName = (url: string | null) => {
  if (!url) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

export const LinkCard = ({
  link,
  onDelete,
  onConfigure,
  isPending,
}: LinkCardProps) => {
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [newPrice, setNewPrice] = useState(link.price.toString());
  const [newUrl, setNewUrl] = useState(link.url || "");
  const [deleteConfirmationActive, setDeleteConfirmationActive] =
    useState(false);
  const deleteConfirmationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const utils = api.useUtils();

  // Reset confirmation state after 3 seconds of inactivity
  useEffect(() => {
    if (deleteConfirmationActive) {
      deleteConfirmationTimeoutRef.current = setTimeout(() => {
        setDeleteConfirmationActive(false);
      }, 3000);
    }

    return () => {
      if (deleteConfirmationTimeoutRef.current) {
        clearTimeout(deleteConfirmationTimeoutRef.current);
      }
    };
  }, [deleteConfirmationActive]);

  const { mutate: updateLink } = api.link.updateLink.useMutation({
    onSuccess: (updatedLink) => {
      setIsUpdatingPrice(false);
      if (updatedLink) {
        link.updatedAt = updatedLink.updatedAt;
      }
      if (link.deviceId) {
        void utils.link.getDeviceLinks.invalidate({ id: link.deviceId });
      }
    },
  });

  const handleUpdate = () => {
    const priceNumber = parseInt(newPrice);
    if (isNaN(priceNumber)) return;

    updateLink({
      id: link.id,
      configId: link.configId,
      skuId: link.skuId,
      price: priceNumber,
      url: newUrl || undefined,
    });
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: dragging,
  } = useDraggable({
    id: link.id,
    data: { current: link },
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString({
          ...transform,
          scaleX: 1,
          scaleY: 1,
        }),
      }
    : undefined;

  const ageStyle = getAgeStyle(link.updatedAt);

  // Function to handle delete button clicks
  const handleDeleteClick = () => {
    if (deleteConfirmationActive) {
      // Second click - perform the deletion
      onDelete(link.id);
      setDeleteConfirmationActive(false);
    } else {
      // First click - activate confirmation mode
      setDeleteConfirmationActive(true);
    }
  };

  return (
    <div className={cn("group relative", dragging && "z-50")}>
      <div className="relative">
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "relative flex w-full items-stretch rounded-lg border border-zinc-200 bg-white shadow-sm",
            dragging && "cursor-grabbing shadow-lg",
            isPending && "ring-4 ring-yellow-500/40",
            !isUpdatingPrice && ageStyle === "aging" && "bg-orange-50/30",
            !isUpdatingPrice && ageStyle === "old" && "bg-orange-100",
            !isUpdatingPrice && ageStyle === "very-old" && "bg-red-50",
            isUpdatingPrice &&
              "rounded-b-none border-b-0 outline-2 outline-offset-[-1px] outline-zinc-200"
          )}
          {...attributes}
        >
          <div
            {...listeners}
            className="flex cursor-grab items-center self-stretch overflow-hidden rounded-l-lg border-r px-3 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 pr-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a
                    href={link.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:opacity-70"
                  >
                    <img
                      src={link.marketplace?.iconUrl || ""}
                      alt=""
                      className="h-5 w-5 rounded border object-contain p-0.5"
                    />
                    <div className="text-sm font-medium text-zinc-600">
                      {link.marketplace?.name}
                    </div>
                  </a>
                  {link.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsUpdatingPrice(true);
                        setTimeout(() => {
                          const urlInput = document.getElementById("url-input");
                          if (urlInput) urlInput.focus();
                        }, 100);
                      }}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors hover:opacity-80 active:opacity-90",
                        getHostStyle(link.url)?.bg,
                        getHostStyle(link.url)?.text,
                        getHostStyle(link.url)?.ring
                      )}
                    >
                      {getHostName(link.url)}
                      <Pencil className="h-3 w-3 opacity-60" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatRelativeTime(link.updatedAt)}
                </div>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <a
                  href={link.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-medium hover:opacity-70"
                >
                  {link.name}
                </a>
                {link.price && (
                  <div className="ml-3 flex-shrink-0 font-medium tabular-nums">
                    {rubleCurrencyFormatter(link.price)}
                  </div>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                {link.config && (
                  <span
                    className={cn(
                      "rounded bg-blue-50 px-2 py-1 font-medium",
                      isPending
                        ? "bg-blue-100 text-blue-800 ring-1 ring-blue-400/30"
                        : "text-blue-700"
                    )}
                  >
                    {link.config.name}
                  </span>
                )}
                {link.sku && (
                  <span
                    className={cn(
                      "rounded bg-purple-50 px-2 py-1 font-medium",
                      isPending
                        ? "bg-purple-100 text-purple-800 ring-1 ring-purple-400/30"
                        : "text-purple-700"
                    )}
                  >
                    Профиль: {link.sku.ram_gb}GB + {link.sku.storage_gb}GB
                  </span>
                )}
                {ageStyle === "very-old" && (
                  <button
                    onClick={() => {
                      setIsUpdatingPrice(true);
                    }}
                    className="flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-red-700 hover:bg-red-100"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Требуется обновление</span>
                  </button>
                )}
                {ageStyle === "fresh" && (
                  <button
                    onClick={() => {
                      setIsUpdatingPrice(true);
                    }}
                    className="flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-green-700 hover:bg-green-100"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Обновлено</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {!isUpdatingPrice && !dragging && (
            <div
              className={cn(
                "invisible absolute bottom-0 right-0 top-0 z-10 flex translate-x-full transform items-stretch overflow-hidden  rounded-r-lg opacity-0 transition-transform duration-75 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100",
                "-ml-[80px] w-[180px]",
                deleteConfirmationActive
                  ? "visible translate-x-0 opacity-100"
                  : "invisible opacity-0 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100"
              )}
            >
              <div
                className={cn(
                  "flex-1  bg-gradient-to-l",
                  ageStyle === "aging" && " from-orange-50/30 via-orange-50/30",
                  ageStyle === "old" && " from-orange-100/40 via-orange-100/40",
                  ageStyle === "very-old" && " from-red-50/50 via-red-50/50",
                  ageStyle === "fresh" && " from-white via-white"
                )}
              />
              <div className="flex w-[100px] flex-col items-stretch justify-center divide-y border-l bg-white shadow-sm">
                <button
                  onClick={() => onConfigure(link)}
                  className="flex h-10 items-center gap-1.5 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>SKU</span>
                </button>
                {
                  <button
                    onClick={() => setIsUpdatingPrice(true)}
                    className="flex h-10 items-center gap-1.5 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Цена</span>
                  </button>
                }
                <button
                  onClick={handleDeleteClick}
                  className={cn(
                    "flex h-10 items-center gap-1.5 px-3 text-xs font-medium transition-colors duration-150",
                    deleteConfirmationActive
                      ? "bg-red-50 text-red-600 hover:bg-red-100"
                      : "text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <Trash2
                    className={cn(
                      "h-3.5 w-3.5",
                      deleteConfirmationActive && "text-red-500"
                    )}
                  />
                  <span>{deleteConfirmationActive ? "Точно?" : "Удалить"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isUpdatingPrice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-0 top-[calc(100%)] z-50 overflow-hidden rounded-lg rounded-t-none border border-t-0 border-zinc-200 bg-white shadow-[0_4px_25px_-5px_rgba(0,0,0,0.1),0_2px_10px_-6px_rgba(0,0,0,0.1)]"
            style={{
              filter:
                "drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdate();
              }}
              className="flex flex-col gap-3 p-3"
            >
              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="price-input"
                    className="text-sm font-medium text-zinc-700"
                  >
                    Обновить цену
                  </label>
                  <a
                    href={link.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>Открыть</span>
                  </a>
                </div>
                <input
                  id="price-input"
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsUpdatingPrice(false);
                  }}
                  placeholder="Новая цена"
                  autoFocus
                />
              </div>

              <div className="flex-1">
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="url-input"
                    className="text-sm font-medium text-zinc-700"
                  >
                    URL
                  </label>
                </div>
                <input
                  id="url-input"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setIsUpdatingPrice(false);
                  }}
                  placeholder="https://"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUpdatingPrice(false)}
                  className="rounded bg-zinc-50 p-2 text-zinc-600 hover:bg-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  className="rounded bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
