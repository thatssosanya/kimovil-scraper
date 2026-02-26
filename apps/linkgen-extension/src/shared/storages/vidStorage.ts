import {
  BaseStorage,
  createStorage,
  StorageType,
} from "@src/shared/storages/base";

export interface VidAuthor {
  id: string;
  name: string;
  vid: string;
}

export const AUTHORS: VidAuthor[] = [
  { id: "default", name: "По умолчанию", vid: "322" },
  { id: "farhad", name: "Фархад", vid: "323" },
  { id: "shamil", name: "Шамиль", vid: "324" },
  { id: "timofey", name: "Тимофей", vid: "325" },
  { id: "danil", name: "Данил", vid: "326" },
  { id: "andrey", name: "Андрей", vid: "327" },
  { id: "ivan", name: "Иван", vid: "328" },
  { id: "ratings", name: "Рейтинги", vid: "ratings" },
  { id: "kick", name: "Кик", vid: "kickpersh" },
];

type VidState = {
  selectedAuthorId: string;
};

type VidStorage = BaseStorage<VidState> & {
  getSelectedAuthor: () => VidAuthor;
  setSelectedAuthor: (authorId: string) => Promise<void>;
};

const storage = createStorage<VidState>(
  "vid-storage",
  {
    selectedAuthorId: "default",
  },
  {
    storageType: StorageType.Local,
    liveUpdate: true,
  },
);

const vidStorage: VidStorage = {
  ...storage,
  getSelectedAuthor: () => {
    const state = storage.getSnapshot();
    const authorId = state?.selectedAuthorId || "default";
    return AUTHORS.find((author) => author.id === authorId) || AUTHORS[0];
  },
  setSelectedAuthor: async (authorId: string) => {
    if (AUTHORS.some((author) => author.id === authorId)) {
      await storage.set((state) => ({
        ...state,
        selectedAuthorId: authorId,
      }));
    }
  },
};

export default vidStorage;
