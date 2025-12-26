import React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInput,
  useSidebar,
} from "@/src/components/ui/Sidebar";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Link from "next/link";
import Logo from "@/src/components/shared/Logo";
import LogoCompact from "@/src/components/shared/LogoCompact";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/src/components/ui/Tooltip";
import {
  Settings,
  Search,
  LayoutList,
  Link2,
  Globe,
  FileJson,
  ListFilter,
  LogOut,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Coins,
  Moon,
  Sun,
  Medal,
  LayoutPanelTop,
  LayoutGrid,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { useCrossDomainTheme } from "@/src/hooks/useCrossDomainTheme";
import { cn } from "@/src/lib/utils";

type NavigationSubItem = {
  name: string;
  href: string;
  tooltip: string;
};

type NavigationItem = {
  name: string;
  href?: string;
  icon: LucideIcon;
  tooltip: string;
  wip?: boolean;
  subItems?: NavigationSubItem[];
};

type NavigationGroups = {
  overview: NavigationItem[];
  devices: NavigationItem[];
  ratings: NavigationItem[];
  tools: NavigationItem[];
};

const navigation: NavigationGroups = {
  overview: [
    {
      name: "Обзор",
      href: "/",
      icon: LayoutGrid,
      tooltip: "Обзор",
    },
  ],
  devices: [
    {
      name: "Устройства",
      href: "/devices",
      icon: LayoutList,
      tooltip: "Устройства",
    },
    {
      name: "Реферальные ссылки",
      href: "/links",
      icon: Link2,
      tooltip: "Реферальные ссылки",
    },
    {
      name: "Партнерские площадки",
      href: "/marketplaces",
      icon: Globe,
      tooltip: "Партнерские площадки",
      wip: true,
    },
  ],
  ratings: [
    {
      name: "Изменить рейтинги",
      href: "/ratings",
      icon: Medal,
      tooltip: "Изменить рейтинги",
    },
    {
      name: "Страница рейтингов",
      href: "/ratings-page",
      icon: LayoutPanelTop,
      tooltip: "Страница рейтингов",
    },
  ],
  tools: [
    {
      name: "Импорт устройств",
      href: "/import",
      icon: ListFilter,
      tooltip: "Импорт устройств",
    },
    {
      name: "Виджеты",
      href: "/widgets",
      icon: FileJson,
      tooltip: "Виджеты",
      wip: true,
    },
    {
      name: "Настройки",
      href: "/settings",
      icon: Settings,
      tooltip: "Настройки",
    },
    {
      name: "Генератор ссылок",
      href: "/tools/link-gen",
      icon: Link2,
      tooltip: "Генератор ссылок",
    },
    {
      name: "AliExpress",
      href: "/aliexpress",
      icon: Coins,
      tooltip: "AliExpress",
    },
  ],
};

const groupLabels: Record<keyof NavigationGroups, string> = {
  overview: "",
  devices: "Девайсы",
  ratings: "Рейтинги",
  tools: "Инструменты",
};

export default function AdminSidebar() {
  const router = useRouter();
  const { user } = useUser();
  const { signOut, openSignIn } = useClerk();
  const { toggleDarkMode } = useCrossDomainTheme();
  const { state, toggleSidebar } = useSidebar();
  const [collapsedGroups, setCollapsedGroups] = React.useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const renderItemContent = (item: NavigationItem) => (
    <>
      <item.icon className="h-4 w-4 shrink-0 opacity-70 group-data-[active=true]:opacity-100" />
      <span className="flex-1 text-sm">{item.name}</span>
      {item.wip && (
        <div className="h-1.5 w-1.5 rounded-full bg-yellow-500/60 dark:bg-yellow-400/50" />
      )}
    </>
  );

  const renderNavigationGroup = (
    items: NavigationItem[],
    groupName: keyof NavigationGroups
  ) => {
    const isCollapsed = collapsedGroups[groupName];
    const hasLabel = groupLabels[groupName] !== "";

    return (
      <SidebarGroup className="group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:items-center">
        {hasLabel && (
          <SidebarGroupLabel asChild>
            <button
              onClick={() => toggleGroup(groupName)}
              className="flex w-full cursor-pointer items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <span>{groupLabels[groupName]}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 opacity-50 transition-transform duration-200",
                  isCollapsed && "-rotate-90"
                )}
              />
            </button>
          </SidebarGroupLabel>
        )}
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out",
            isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
          )}
        >
          <SidebarMenu className="mt-0.5 group-data-[collapsible=icon]:items-center">
            {items.map((item) => (
              <SidebarMenuItem key={item.name}>
                {item.subItems ? (
                  <>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.tooltip,
                        className:
                          "bg-gray-900/95 text-gray-100 border border-gray-800 shadow-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 animate-none data-[state=closed]:animate-none [&>svg]:hidden",
                      }}
                      className={cn(
                        "group cursor-pointer",
                        "text-gray-600 dark:text-gray-300",
                        "hover:bg-gray-100 dark:hover:bg-gray-700/20",
                        "hover:text-gray-900 dark:hover:text-gray-200",
                        "group-data-[collapsible=icon]:!size-6 group-data-[collapsible=icon]:!p-1.5"
                      )}
                    >
                      {renderItemContent(item)}
                    </SidebarMenuButton>
                    <SidebarMenuSub>
                      {item.subItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.name}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={
                              router.asPath === "/dashboard" + subItem.href
                            }
                            className={cn(
                              "group cursor-pointer",
                              "text-gray-600 dark:text-gray-500",
                              "hover:bg-gray-50 dark:hover:bg-gray-800/20",
                              "hover:text-gray-900 dark:hover:text-gray-300",
                              "data-[active=true]:bg-gray-100 dark:data-[active=true]:bg-gray-700/40",
                              "data-[active=true]:text-gray-900 dark:data-[active=true]:text-gray-200"
                            )}
                          >
                            <Link href={"/dashboard" + subItem.href}>
                              <span className="text-sm">{subItem.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </>
                ) : (
                  <SidebarMenuButton
                    asChild
                    tooltip={{
                      children: item.tooltip,
                      className:
                        "bg-gray-900/95 text-gray-100 border border-gray-800 shadow-lg dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 animate-none data-[state=closed]:animate-none [&>svg]:hidden",
                    }}
                    isActive={
                      item.href === "/"
                        ? router.asPath === "/dashboard" || router.asPath === "/dashboard/"
                        : router.asPath === "/dashboard" + item.href
                    }
                    className={cn(
                      " group cursor-pointer duration-200",
                      "text-gray-600 dark:text-gray-300",
                      "hover:bg-gray-100 dark:hover:bg-gray-700/20",
                      "hover:text-gray-900 dark:hover:text-gray-200",
                      "data-[active=true]:bg-gray-100 dark:data-[active=true]:bg-gray-700/40",
                      "data-[active=true]:text-gray-900 dark:data-[active=true]:text-gray-200",
                      "group-data-[collapsible=icon]:!size-6 group-data-[collapsible=icon]:!p-1.5"
                    )}
                  >
                    <Link href={"/dashboard" + item.href!}>
                      {renderItemContent(item)}
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar className="border-none" collapsible="icon">
      <SidebarHeader className="space-y-4 p-4">
        <Link href="/dashboard">
          <div className="hover:text-primary text-primary/90 dark:text-primary/80 dark:hover:text-primary">
            {/* Expanded logo + label */}
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
              <div className="w-24">
                <Logo />
              </div>
              <div className="font-mono text-xs font-bold opacity-80">
                Каталог
              </div>
            </div>
            {/* Compact logo */}
            <div className="hidden items-center justify-center group-data-[collapsible=icon]:flex">
              <LogoCompact className="h-8 w-8 opacity-90" />
            </div>
          </div>
        </Link>

        <SignedIn>
          <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 p-2.5 hover:from-gray-200 hover:to-gray-100 group-data-[collapsible=icon]:overflow-visible group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0 dark:from-gray-800/50 dark:to-transparent dark:hover:from-gray-800 dark:hover:to-gray-800/50">
            <div className="relative flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
              <img
                className="h-8 w-8 rounded-full object-cover ring-2 ring-gray-200 group-hover:ring-gray-300 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 dark:ring-gray-700 dark:group-hover:ring-gray-600"
                src={user?.imageUrl}
                alt=""
              />
              <div className="flex min-w-0 flex-1 items-center justify-between group-data-[collapsible=icon]:hidden">
                <span className="text-foreground truncate text-sm font-medium dark:text-gray-200">
                  {user?.username}
                </span>
                <button
                  onClick={() => void signOut()}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </SignedIn>

        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-600" />
          <SidebarInput
            type="search"
            placeholder="Поиск..."
            className="w-full cursor-text border-gray-200 bg-gray-50 pl-8 placeholder:text-gray-400 hover:bg-gray-100 focus:border-gray-300 focus:bg-white dark:border-gray-800 dark:bg-gray-900/50 dark:placeholder:text-gray-600 dark:hover:bg-gray-800/30 dark:focus:border-gray-700 dark:focus:bg-gray-800/30"
          />
        </div>

        {/* Compact search button */}
        <div className="hidden items-center justify-center group-data-[collapsible=icon]:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/50"
                aria-label="Поиск"
                title="Поиск"
              >
                <Search className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              className="animate-none border border-gray-800 bg-gray-900/95 text-gray-100 shadow-lg data-[state=closed]:animate-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 [&>svg]:hidden"
            >
              Поиск
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="space-y-4 overflow-x-hidden px-2 py-2 group-data-[collapsible=icon]:px-0.5 group-data-[collapsible=icon]:items-center">
        {renderNavigationGroup(navigation.overview, "overview")}
        {renderNavigationGroup(navigation.devices, "devices")}
        {renderNavigationGroup(navigation.ratings, "ratings")}
        {renderNavigationGroup(navigation.tools, "tools")}
      </SidebarContent>

      <SidebarFooter className="space-y-4 p-4 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:pb-4 group-data-[collapsible=icon]:items-center">
        <SignedOut>
          <button
            onClick={() => void openSignIn()}
            className="hover:text-primary-highLight from-primary/10 via-primary/[0.07] to-primary/5 text-primary hover:from-primary/20 hover:via-primary/[0.15] hover:to-primary/10 group flex w-full items-center justify-between gap-2 rounded-lg bg-gradient-to-r px-4 py-3 text-sm font-medium group-data-[collapsible=icon]:hidden"
          >
            <span>Войти в систему</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5" />
          </button>
        </SignedOut>

        <div className="flex items-center gap-1 self-end group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:self-center">
          <button
            onClick={toggleSidebar}
            className="group relative cursor-pointer rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/50"
            aria-label="Свернуть боковую панель"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                "text-gray-400 group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-400",
                state === "collapsed" && "rotate-180"
              )}
            />
          </button>
          <button
            onClick={toggleDarkMode}
            className="group relative cursor-pointer rounded-md p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/50"
            aria-label="Переключить тему"
          >
            <div className="relative h-4 w-4">
              <Sun
                className={cn(
                  "absolute inset-0 h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0",
                  "text-gray-400 group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-400"
                )}
              />
              <Moon
                className={cn(
                  "absolute inset-0 h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100",
                  "text-gray-400 group-hover:text-gray-600 dark:text-gray-600 dark:group-hover:text-gray-400"
                )}
              />
            </div>
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
