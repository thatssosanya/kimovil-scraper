import { Skeleton } from "@/src/components/ui/Skeleton";

export const DevicePageSkeleton = () => {
  return (
    <div className="mt-14 flex flex-col gap-16 pb-8">
      {/* Header Section */}
      <div className="grid grid-cols-2 gap-16">
        {/* Left side - Image and preview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-4 grid h-[450px] grid-cols-2 rounded-3xl bg-gray-100 dark:bg-gray-800">
            <div className="h-full w-full rounded-lg p-12">
              <Skeleton className="h-full w-full" />
            </div>
            <div className="flex items-center justify-center px-12">
              <Skeleton className="h-48 w-32" />
            </div>
          </div>
          <Skeleton className="h-[155px] w-full rounded-3xl" />
          <Skeleton className="h-[155px] w-full rounded-3xl" />
          <Skeleton className="h-[155px] w-full rounded-3xl" />
          <Skeleton className="h-[155px] w-full rounded-3xl" />
        </div>

        {/* Right side - Device info */}
        <div className="flex flex-col items-start justify-start gap-4">
          <div className="flex h-[450px] w-full flex-col gap-4">
            <Skeleton className="h-16 w-3/4" /> {/* Title */}
            <Skeleton className="h-10 w-1/3" /> {/* Release date */}
            <Skeleton className="h-6 w-full" /> {/* Description line 1 */}
            <Skeleton className="h-6 w-2/3" /> {/* Description line 2 */}
            
            <div className="mt-auto flex flex-col gap-4">
              {/* Rating badge */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-40" /> {/* Value rating */}
            </div>
          </div>
          <Skeleton className="h-[155px] w-full rounded-3xl" /> {/* Purchase options */}
        </div>
      </div>

      {/* Pros and Cons Section */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-80" /> {/* Section title */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>

      {/* Specifications Section */}
      <div className="flex flex-col gap-8">
        <Skeleton className="h-10 w-72" /> {/* Section title */}
        <div className="space-y-12">
          {/* Multiple specification sections */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-48" /> {/* Subsection title */}
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relevant Devices Section */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" /> {/* Section title */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};