import React from "react";

interface TwoColumnsProps {
  children: React.ReactNode[];
}

const TwoColumns = (props: TwoColumnsProps) => {
  const { children } = props;
  return (
    <div className="flex h-full w-full">
      <aside className="relative w-96 flex-shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-700">
        {children[0] && children[0]}
      </aside>
      <main className="relative z-0 flex-1 overflow-y-auto focus:outline-none">
        {children[1] && children[1]}
      </main>
    </div>
  );
};

export default TwoColumns;
