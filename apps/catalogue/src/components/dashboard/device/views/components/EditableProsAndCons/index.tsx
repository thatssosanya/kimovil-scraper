import React from "react";
import { useProsCons } from "./hooks";
import { ValueRatingSection } from "./ValueRatingSection";
import { ProsConsColumn } from "./ProsConsColumn";

interface EditableProsAndConsProps {
  deviceId: string;
}

const LoadingSkeleton: React.FC = () => (
  <div className="w-full rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div className="animate-pulse space-y-4">
      <div className="space-y-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="h-4 w-1/4 rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700"></div>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700"></div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="h-4 w-1/5 rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-9 w-full rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-6 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-6 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-1/5 rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-9 w-full rounded bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="h-6 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700"></div>
        </div>
      </div>
    </div>
  </div>
);

export const EditableProsAndCons: React.FC<EditableProsAndConsProps> = ({
  deviceId,
}) => {
  const {
    pros,
    cons,
    add,
    update,
    remove,
    isPending: isProsConsLoading,
  } = useProsCons(deviceId);

  if (isProsConsLoading) {
    return (
      <section
        className="mx-4 transition-all duration-200"
        aria-busy="true"
        aria-label="Загрузка преимуществ и недостатков..."
      >
        <LoadingSkeleton />
      </section>
    );
  }

  return (
    <section
      className="mx-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Преимущества и недостатки"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ValueRatingSection deviceId={deviceId} className="col-span-full" />

        <ProsConsColumn
          title="Плюсы"
          color="emerald"
          items={pros}
          addMutation={add}
          updateMutation={update}
          deleteMutation={remove}
          deviceId={deviceId}
          type="pro"
        />

        <ProsConsColumn
          title="Минусы"
          color="rose"
          items={cons}
          addMutation={add}
          updateMutation={update}
          deleteMutation={remove}
          deviceId={deviceId}
          type="con"
        />
      </div>
    </section>
  );
};
