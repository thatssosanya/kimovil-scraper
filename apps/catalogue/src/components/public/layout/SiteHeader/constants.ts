type MenuItem = {
  id: string;
  title: string;
  href: string;
  external?: boolean;
  icon?: React.ReactNode;
  hasDropdown?: boolean;
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "offers",
    title: "Скидки",
    href: "https://click-or-die.ru/category/offers",
    external: true,
  },
  {
    id: "guides",
    title: "Обзоры и гайды",
    href: "https://click-or-die.ru/category/guides",
    external: true,
  },
  {
    id: "catalogue",
    title: "Каталог",
    href: "/devices",
    external: false,
  },
  {
    id: "ratings",
    title: "Рейтинги",
    href: "/ratings",
    external: false,
    hasDropdown: true,
  },
  {
    id: "stories",
    title: "Истории",
    href: "https://click-or-die.ru/category/stories",
    external: true,
  },
];
