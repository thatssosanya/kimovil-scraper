import {
  formatRelativeTime,
  isSelected,
  rubleCurrencyFormatter,
} from "@/src/utils/utils";
import type { Link } from "@/src/server/db/schema";
import React, {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { AddLinkDialogue } from "@/src/components/dashboard/link/components/dialogs/AddLinkDialogue";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/src/components/ui/ContextMenu";
import { Input } from "@/src/components/ui/Input";
import { SearchIcon } from "lucide-react";
import { api } from "@/src/utils/api";
import { useDebounce } from "@/src/hooks/useDebounce";

type LinkListProps = {
  setSelectedLink: Dispatch<SetStateAction<Link | undefined>>;
  selectedLink?: Link;
};

const LinkList = ({ selectedLink, setSelectedLink }: LinkListProps) => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const debouncedSearch = useDebounce(searchKeyword, 300);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    api.link.getAllLinks.useInfiniteQuery(
      {
        limit: 20,
        search: debouncedSearch,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }
    );

  const utils = api.useUtils();
  const { mutate: deleteLink } = api.link.deleteLink.useMutation({
    onSuccess: async () => {
      await utils.link.getAllLinks.invalidate();
    },
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const allLinks = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="relative flex flex-col">
      <div className="sticky top-0 z-50 flex flex-shrink-0 flex-col gap-2 border-b border-zinc-200 bg-zinc-100 p-2">
        <div className="flex flex-shrink-0 items-center gap-2">
          <SearchIcon className="text-zinc-400" />
          <Input
            placeholder="Поиск"
            value={searchKeyword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchKeyword(e.target.value)
            }
            className="flex-1 bg-white"
          />
        </div>
      </div>

      {isPending ? (
        <div className="flex justify-center p-4">Loading...</div>
      ) : allLinks.length === 0 ? (
        <div className="flex justify-center p-4 text-zinc-500">
          Ничего не найдено
        </div>
      ) : (
        <>
          {allLinks.map((item) => (
            <ContextMenu key={item.id}>
              <ContextMenuTrigger>
                <div
                  onClick={() => setSelectedLink(item)}
                  className={`${
                    isSelected(item, selectedLink)
                      ? "bg-zinc-100"
                      : "bg-white hover:bg-zinc-50"
                  } flex w-full cursor-pointer items-center gap-2 border-b px-4 py-2 transition`}
                >
                  <img
                    alt=""
                    className="aspect-square h-8 rounded border object-cover"
                    src={item.marketplace?.iconUrl ?? ""}
                  />
                  <div className="flex flex-col items-start rounded px-2 py-1 font-bold">
                    <span className="text-xs text-zinc-600">
                      {item.marketplace?.name}
                    </span>
                    <span className="text-normal font-medium">{item.name}</span>
                  </div>
                  {item.price && item.createdAt && (
                    <div className="ml-auto flex flex-col items-end rounded px-2 py-1 font-bold">
                      <div className="text-xs font-normal text-zinc-600">
                        {formatRelativeTime(item.createdAt)}
                      </div>
                      <div className="text-base font-medium">
                        {rubleCurrencyFormatter(item.price)}
                      </div>
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    deleteLink({ id: item.id });
                  }}
                >
                  Удалить
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}

          <div ref={loadMoreRef} className="py-4">
            {isFetchingNextPage && (
              <div className="flex justify-center">Подгрузка...</div>
            )}
          </div>
        </>
      )}

      <div className="sticky bottom-0 flex w-full justify-start px-4 py-0">
        <AddLinkDialogue />
      </div>
    </div>
  );
};

export default LinkList;
