"use client";

import React from "react";
import useHeaderStore from "@/src/stores/headerStore";

export default function Header() {
  const { title, leftActions, rightActions } = useHeaderStore();

  return (
    <header className="bg-sidebar flex h-16 w-full flex-shrink-0 ">
      <div className="flex h-full flex-1 items-center justify-center pr-4">
        <div className="mr-auto flex flex-shrink-0 items-center gap-2">
          {leftActions.map((action, index) => (
            <React.Fragment key={index}>{action}</React.Fragment>
          ))}
        </div>

        <h1 className="min-w-[200px] text-center text-base font-medium text-black dark:text-white">
          {title}
        </h1>

        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          {rightActions.map((action, index) => (
            <React.Fragment key={index}>{action}</React.Fragment>
          ))}
        </div>
      </div>
    </header>
  );
}
