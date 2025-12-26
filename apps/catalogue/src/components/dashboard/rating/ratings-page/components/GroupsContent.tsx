import React from "react";
import { Button } from "@/src/components/ui/Button";
import { SortableRatingsList } from "@/src/components/dashboard/rating/components/SortableRatingsList";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/Tabs";
import { Plus, FolderPlus, Undo2, Settings } from "lucide-react";
import useRatingsPageStore from "@/src/stores/ratingsPageStore";

type RatingPosition = {
  id: string;
  position: number;
  shortName: string | null;
  ratingId: string;
  groupId: string;
  createdAt: Date;
  updatedAt: Date;
  rating: {
    id: string;
    name: string;
    ratingType: {
      id: string;
      name: string;
      displayName: string | null;
    } | null;
  };
};

interface RatingsGroup {
  id: string;
  name: string;
  displayName: string | null;
  description: string | null;
  displayType: string;
  type: string | null;
  ratings: RatingPosition[];
}

interface RatingsPage {
  id: string;
  name: string;
  description: string | null;
  groups: Array<{
    position: number;
    group: RatingsGroup;
  }>;
}

const DISPLAY_TYPES = [
  { value: "regular", label: "Обычный" },
  { value: "feature", label: "1-й рекоменд." },
  { value: "single", label: "Только 1-й" },
];

interface GroupsContentProps {
  selectedPage: RatingsPage;
  onCreateGroup: () => void;
  onEditGroup: (group: RatingsGroup) => void;
  onAddRatingToGroup: (
    groupId: string,
    groupName: string,
    existingRatingIds: string[]
  ) => void;
  onUpdateGroupRatingPositions: (
    groupId: string,
    newPositions: Record<number, string>
  ) => void;
  onShortNameChange: (
    groupId: string,
    ratingId: string,
    shortName: string
  ) => void;
  onRemoveRating: (groupId: string, ratingId: string) => void;
  onUpdateGroupDisplayType: (groupId: string, displayType: string) => void;
}

export const GroupsContent = ({
  selectedPage,
  onCreateGroup,
  onEditGroup,
  onAddRatingToGroup,
  onUpdateGroupRatingPositions,
  onShortNameChange,
  onRemoveRating,
  onUpdateGroupDisplayType,
}: GroupsContentProps) => {
  const store = useRatingsPageStore();

  if (selectedPage.groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FolderPlus className="text-muted-foreground/50 mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-medium">Нет групп рейтингов</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Создайте группу для организации рейтингов на этой странице
          </p>
          <Button onClick={onCreateGroup} className="mt-4 gap-2">
            <FolderPlus className="h-4 w-4" />
            Создать группу
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Группы рейтингов</h2>
        <Button
          onClick={onCreateGroup}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Добавить группу
        </Button>
      </div>

      <div className="grid gap-4">
        {selectedPage.groups
          .sort((a, b) => a.position - b.position)
          .map((groupPos) => {
            const hasPendingGroupChanges = store.getPendingGroupChanges(
              groupPos.group.id
            );

            return (
              <div
                key={groupPos.group.id}
                className="bg-card rounded-lg border transition-shadow hover:shadow-sm"
              >
                <div className="space-y-4 border-b p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                        {groupPos.position}
                      </div>
                      <div>
                        <h4 className="font-medium">{groupPos.group.name}</h4>
                        {groupPos.group.description && (
                          <p className="text-muted-foreground text-sm">
                            {groupPos.group.description}
                          </p>
                        )}
                        {groupPos.group.type && (
                          <span className="bg-secondary mt-1 inline-block rounded-full px-2 py-1 text-xs">
                            {groupPos.group.type}
                          </span>
                        )}
                      </div>
                      {hasPendingGroupChanges && (
                        <div className="h-2 w-2 rounded-full bg-orange-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasPendingGroupChanges && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            store.revertGroupChanges(groupPos.group.id)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onEditGroup(groupPos.group)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-muted-foreground mb-2 text-xs font-medium">
                      Тип отображения
                    </div>
                    <Tabs
                      value={groupPos.group.displayType}
                      onValueChange={(value) =>
                        onUpdateGroupDisplayType(groupPos.group.id, value)
                      }
                    >
                      <TabsList className="grid h-8 w-full grid-cols-3">
                        {DISPLAY_TYPES.map((type) => (
                          <TabsTrigger
                            key={type.value}
                            value={type.value}
                            className="px-2 py-1 text-xs"
                          >
                            {type.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-muted-foreground flex items-center justify-between text-sm">
                    <span>
                      {groupPos.group.ratings.length} рейтингов в группе
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        onAddRatingToGroup(
                          groupPos.group.id,
                          groupPos.group.name,
                          groupPos.group.ratings.map((r) => r.ratingId)
                        )
                      }
                    >
                      <Plus className="h-4 w-4" />
                      Добавить рейтинг
                    </Button>
                  </div>

                  {groupPos.group.ratings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <h4 className="text-foreground text-sm font-medium">
                        Рейтинги в группе:
                      </h4>
                      <SortableRatingsList
                        ratings={groupPos.group.ratings}
                        groupId={groupPos.group.id}
                        pendingChanges={
                          store.getPendingGroupChanges(groupPos.group.id)
                            ?.positions
                        }
                        hasPendingChanges={
                          !!store.getPendingGroupChanges(groupPos.group.id)
                        }
                        onUpdatePositions={(newPositions) =>
                          onUpdateGroupRatingPositions(
                            groupPos.group.id,
                            newPositions
                          )
                        }
                        onShortNameChange={(groupId, ratingId, shortName) =>
                          onShortNameChange(groupId, ratingId, shortName)
                        }
                        onRemoveRating={(groupId, ratingId) =>
                          onRemoveRating(groupId, ratingId)
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
