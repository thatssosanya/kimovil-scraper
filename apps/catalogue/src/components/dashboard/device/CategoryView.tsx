import { api } from "@/src/utils/api";
import type { Rating, RatingCategory } from "@/src/server/db/schema";
import React, { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { Label } from "@/src/components/ui/Label";
import { ComboBox } from "@/src/components/ui/ComboBox";
import { Input } from "@/src/components/ui/Input";

export type CategoryWithRatings = RatingCategory & {
  Rating: Rating[];
};

type CategoryViewProps = {
  category: CategoryWithRatings;
};

export const CategoryView = (props: CategoryViewProps) => {
  const { category } = props;
  const [selectedRating, setSelectedRating] = React.useState<Rating>();
  const [editMode, setEditMode] = useState(false);
  const [editedCategory, setEditedCategory] = useState({
    name: category.name || "",
    slug: category.slug || "",
    description: category.description || "",
  });

  const utils = api.useUtils();

  useEffect(() => {
    setEditedCategory({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
    });
  }, [category]);

  const { data: ratings } = api.rating.getAllRatings.useQuery();
  const { mutate: addRating } = api.rating.addRatingToCategory.useMutation({
    onSuccess: () => {
      setSelectedRating(undefined);
      utils.rating.getAllCategories.invalidate().catch((e) => console.error(e));
    },
  });

  const { mutate: updateCategory } =
    api.rating.updateRatingCategory.useMutation({
      onSuccess: () => {
        setEditMode(false);
        utils.rating.getAllCategories
          .invalidate()
          .catch((e) => console.error(e));
      },
    });

  const handleEditSubmit = () => {
    updateCategory({
      id: category.id,
      ...editedCategory,
    });
  };

  return (
    <div>
      <div className="border-b border-zinc-200 bg-zinc-100 px-8 py-4">
        {editMode ? (
          <div className="flex flex-col gap-2">
            <Input
              value={editedCategory.name}
              onChange={(e) =>
                setEditedCategory({ ...editedCategory, name: e.target.value })
              }
              placeholder="Название категории"
            />
            <Input
              value={editedCategory.slug}
              onChange={(e) =>
                setEditedCategory({ ...editedCategory, slug: e.target.value })
              }
              placeholder="Слаг категории"
            />
            <Input
              value={editedCategory.description}
              onChange={(e) =>
                setEditedCategory({
                  ...editedCategory,
                  description: e.target.value,
                })
              }
              placeholder="Описание категории"
            />
            <div className="flex gap-2">
              <Button onClick={handleEditSubmit}>Сохранить</Button>
              <Button onClick={() => setEditMode(false)}>Отмена</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold ">{category.name}</div>
            <div>{category.description}</div>
            <Button onClick={() => setEditMode(true)}>Редактировать</Button>
          </>
        )}
      </div>
      <div className="px-8 py-2">
        <div className="flex items-center gap-2 text-xl font-medium">
          <div>Рейтинги</div>
          <div className="rounded-md bg-zinc-200 px-2 py-1 text-sm font-medium text-zinc-800">
            {category.Rating.length}
          </div>
        </div>
        <div>
          {category.Rating.map((el) => (
            <div key={el.id}>{el.name}</div>
          ))}
        </div>
        <div className="mx-auto my-4 mt-16 flex w-max flex-col gap-2 rounded border px-2 py-4">
          <Label className="">Добавить рейтинг в категорию </Label>
          <div className="flex flex-col gap-2">
            <ComboBox
              placeholder="Выбрать"
              values={
                ratings
                  ?.filter(
                    (el) => !category.Rating.map((rating) => rating.id).includes(el.id)
                  )
                  .map((el) => ({
                    value: {
                      id: el.id,
                      name: el.name || "",
                    },
                    label: el.name || "",
                  })) || []
              }
              value={selectedRating?.id || ""}
              setValue={(id) => {
                const rating = ratings?.find((el) => el.id === id);
                if (rating) {
                  setSelectedRating(rating);
                }
              }}
            />
            {selectedRating && (
              <Button
                className="w-max border bg-black text-white"
                variant={"default"}
                onClick={() =>
                  addRating({
                    ratingId: selectedRating.id,
                    categoryId: category?.id || "",
                  })
                }
              >
                Добавить
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
