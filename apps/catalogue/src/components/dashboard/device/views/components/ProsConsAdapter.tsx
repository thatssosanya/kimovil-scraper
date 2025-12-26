import React from "react";
import { api } from "@/src/utils/api";

interface ProsConsAdapterProps {
  deviceId: string;
}

export const ProsConsAdapter: React.FC<ProsConsAdapterProps> = ({
  deviceId,
}) => {
  const { data, isPending } = api.device.getDeviceProsAndCons.useQuery(
    { deviceId },
    { refetchOnWindowFocus: false, refetchOnMount: false, staleTime: Infinity }
  );

  if (isPending) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex animate-pulse flex-col space-y-3">
          <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  // If there are no pros and cons, don't render anything
  if (!data || (data.pros.length === 0 && data.cons.length === 0)) {
    return null;
  }

  return (
    <section
      className="flex flex-col gap-2"
      aria-label="Преимущества и недостатки"
    >
      {/* Pros Column */}
      <div className="flex flex-wrap gap-2">
        {data.pros.length > 0 &&
          data.pros.map((pro) => (
            <div
              key={pro.id}
              className="flex items-start rounded-full bg-[#5ADB43]/20 p-4 transition hover:bg-[#5ADB43]/30 dark:bg-green-900/30 dark:hover:bg-green-900/50"
            >
              <span className="font-semibold leading-[16px] text-[#40B32C] dark:text-green-400">
                {pro.text}
              </span>
            </div>
          ))}
      </div>

      {/* Cons Column */}
      <div className="flex flex-wrap gap-2">
        {data.cons.length > 0 &&
          data.cons.map((pro) => (
            <div
              key={pro.id}
              className="flex items-start rounded-full bg-[#FAFAFA] p-4 transition hover:bg-[#FAFAFA]/30 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <span className="font-semibold leading-[16px] text-[#EB4967] dark:text-red-400">
                {pro.text}
              </span>
            </div>
          ))}
      </div>
    </section>
  );
};
