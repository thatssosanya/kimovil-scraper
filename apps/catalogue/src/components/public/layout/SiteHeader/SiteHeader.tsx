"use client";
import Link from "next/link";
import React, { useState, useRef, useEffect } from "react";
import Logo from "@/src/components/shared/Logo";
import { Search, Menu, X, Settings, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SignedIn } from "@clerk/nextjs";
import { useCrossDomainTheme } from "@/src/hooks/useCrossDomainTheme";

import { MENU_ITEMS } from "./constants";
import {
  slideVariants,
  backdropVariants,
  menuItemVariants,
  containerVariants,
} from "./animations";
import { useMobileMenu } from "./hooks/useMobileMenu";
import NavItem from "./components/NavItem";
import type { SiteHeaderProps } from "./types";

const SiteHeader = (props: SiteHeaderProps) => {
  const [searchString, setSearchString] = useState("");
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme, toggleDarkMode } = useCrossDomainTheme();
  const isDark = resolvedTheme === "dark";

  const {
    isMobileMenuOpen,
    mobileMenuRef,
    hamburgerButtonRef,
    openMobileMenu,
    closeMobileMenu,
    handleMenuItemClick,
  } = useMobileMenu();

  const isActiveItem = (itemId: string) => {
    if (itemId === "ratings" && props.activeTab === "ratings") return true;
    if (itemId === "catalogue" && props.activeTab === "devices") return true;
    return false;
  };

  const handleMobileSearchClick = () => {
    setIsMobileSearchExpanded(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 100);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchString.trim()) {
      window.location.href = `/search/${encodeURIComponent(searchString)}`;
    }
  };

  const handleSlideoverSearchClick = () => {
    closeMobileMenu();
    setTimeout(() => {
      setIsMobileSearchExpanded(true);
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 100);
    }, 250);
  };

  // Handle escape key to close mobile search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileSearchExpanded) {
        setIsMobileSearchExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSearchExpanded]);

  return (
    <div className="bg-white dark:bg-gray-900">
      <div className="mx-auto px-4 py-2 xl:container">
        <header className="sticky top-0 z-50 w-full bg-white dark:bg-gray-900">
          <nav className="mx-auto " role="navigation" aria-label="Главное меню">
            <div className="flex h-16 items-center">
              {/* Mobile Menu Button - Left */}
              <motion.button
                ref={hamburgerButtonRef}
                type="button"
                className="mr-3 inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400 lg:hidden"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
                onClick={openMobileMenu}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="sr-only">Открыть главное меню</span>
                <Menu className="h-5 w-5" aria-hidden="true" />
              </motion.button>

              {/* Logo - Right of menu button on mobile, Left on desktop */}
              <div className="flex items-center">
                <Link
                  href="https://click-or-die.ru"
                  className="flex items-center"
                >
                  <div className="w-[120px] sm:w-[136px]">
                    <Logo className="text-primary" />
                  </div>
                </Link>
              </div>

              {/* Dashboard Button - Outside logo container */}
              <SignedIn>
                <Link
                  href="/dashboard"
                  className=" absolute left-[-100px] flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500 opacity-70 transition-opacity duration-200 hover:bg-gray-100 hover:text-gray-700 hover:opacity-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  title="Админка"
                >
                  <Settings className="h-3 w-3" />
                  <span className="text-xs">Админка</span>
                </Link>
              </SignedIn>

              {/* Desktop Navigation Menu - Center */}
              <div className="hidden flex-1 justify-center lg:flex">
                <div className="flex items-center space-x-1">
                  {MENU_ITEMS.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      active={isActiveItem(item.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Dark Mode Toggle & Search - Right */}
              <div className="ml-auto flex items-center gap-2">
                {/* Dark Mode Toggle */}
                <motion.button
                  type="button"
                  onClick={toggleDarkMode}
                  className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Переключить тему"
                >
                  <span className="sr-only">Переключить тему</span>
                  {isDark ? (
                    <Sun className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Moon className="h-5 w-5" aria-hidden="true" />
                  )}
                </motion.button>
                {/* Desktop Search Input */}
                <div className="hidden xl:flex">
                  <form className="relative" onSubmit={handleSearchSubmit}>
                    <label htmlFor="desktop-search" className="sr-only">
                      Поиск
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="desktop-search"
                        className="block w-64 rounded-full bg-gray-100 py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-gray-600 dark:focus:bg-gray-700 dark:focus:ring-gray-600"
                        placeholder="Поиск..."
                        value={searchString}
                        onChange={(e) => setSearchString(e.target.value)}
                        type="search"
                        name="search"
                      />
                    </div>
                  </form>
                </div>

                {/* Mobile/Tablet Search - Expandable */}
                <div className="relative xl:hidden">
                  <AnimatePresence>
                    {isMobileSearchExpanded ? (
                      <motion.form
                        className="absolute right-0 top-1/2 -translate-y-1/2"
                        onSubmit={handleSearchSubmit}
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 240, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
                      >
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          </div>
                          <input
                            ref={mobileSearchInputRef}
                            className="block w-full rounded-full bg-gray-100 py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-gray-600 dark:focus:bg-gray-700 dark:focus:ring-gray-600"
                            placeholder="Поиск..."
                            value={searchString}
                            onChange={(e) => setSearchString(e.target.value)}
                            type="search"
                            name="search"
                            onBlur={() => setIsMobileSearchExpanded(false)}
                          />
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setIsMobileSearchExpanded(false)}
                          >
                            <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          </button>
                        </div>
                      </motion.form>
                    ) : (
                      <motion.button
                        type="button"
                        onClick={handleMobileSearchClick}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400"
                      >
                        <span className="sr-only">Поиск</span>
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </nav>
        </header>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 lg:hidden"
              aria-hidden={!isMobileMenuOpen}
            >
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
                variants={backdropVariants}
                initial="closed"
                animate="open"
                exit="closed"
                onClick={closeMobileMenu}
              />

              {/* Slide-out Menu */}
              <motion.div
                ref={mobileMenuRef}
                className="fixed inset-y-0 left-0 w-full max-w-sm bg-white shadow-2xl dark:bg-gray-900"
                id="mobile-menu"
                role="menu"
                aria-labelledby="mobile-menu-button"
                variants={slideVariants}
                initial="closed"
                animate="open"
                exit="closed"
              >
                <div className="flex h-full flex-col">
                  {/* Header with logo positioned to align with main logo */}
                  <motion.div
                    className="flex h-16 items-center border-b border-gray-100 px-4 dark:border-gray-800 sm:px-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {/* Logo positioned to overlay exactly over main header logo */}
                    <motion.div
                      className="ml-[32px] flex items-center"
                      initial={{ x: -10, opacity: 0.8 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{
                        delay: 0.15,
                        duration: 0.2,
                        ease: [0.4, 0.0, 0.2, 1],
                      }}
                    >
                      <div className="flex items-center">
                        <Link
                          href="https://click-or-die.ru"
                          className="flex items-center"
                        >
                          <div className="w-[120px] sm:w-[136px]">
                            <Logo className="text-primary" />
                          </div>
                        </Link>
                      </div>
                    </motion.div>

                    {/* Close and Search on the right */}
                    <div className="ml-auto flex items-center space-x-2">
                      {/* Dark Mode Toggle */}
                      <motion.button
                        type="button"
                        onClick={toggleDarkMode}
                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="sr-only">Переключить тему</span>
                        {isDark ? (
                          <Sun className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <Moon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </motion.button>

                      {/* Search Icon */}
                      <motion.button
                        type="button"
                        onClick={handleSlideoverSearchClick}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400"
                      >
                        <span className="sr-only">Поиск</span>
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </motion.button>

                      {/* Close button */}
                      <motion.button
                        type="button"
                        onClick={closeMobileMenu}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400 dark:focus:ring-gray-400"
                      >
                        <span className="sr-only">Закрыть меню</span>
                        <X className="h-5 w-5" aria-hidden="true" />
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Menu Items */}
                  <motion.nav
                    className="flex-1 px-6 py-6"
                    role="none"
                    variants={containerVariants}
                    initial="closed"
                    animate="open"
                  >
                    {MENU_ITEMS.map((item, index) => (
                      <motion.div
                        key={item.id}
                        role="menuitem"
                        variants={menuItemVariants}
                        custom={index}
                        className="mb-1"
                      >
                        <NavItem
                          item={item}
                          active={isActiveItem(item.id)}
                          onClick={handleMenuItemClick}
                          isMobile={true}
                          className="px-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-500"
                        />
                      </motion.div>
                    ))}
                  </motion.nav>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SiteHeader;
