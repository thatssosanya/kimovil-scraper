import { useState } from "react";
import Image from "next/image";
import { cn } from "@/src/utils/cn";

interface DeviceImageProps {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  fill?: boolean;
}

// Simple, subtle phone placeholder using basic CSS shapes
const PhonePlaceholder = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      style={style}
    >
      <div className="relative flex items-center justify-center">
        {/* Simple phone outline */}
        <div className="h-12 w-8 rounded-lg border border-zinc-200 bg-white/50 opacity-40">
          {/* Screen area */}
          <div className="m-1 h-8 rounded-sm bg-zinc-100 opacity-60"></div>
          {/* Home button */}
          <div className="mx-auto mt-1 h-1 w-1 rounded-full bg-zinc-200"></div>
        </div>
      </div>
    </div>
  );
};

export const DeviceImage = ({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fill = false,
}: DeviceImageProps) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Show placeholder if no src or error occurred
  if (!src || imageError) {
    return (
      <PhonePlaceholder
        className={cn("bg-transparent", className)}
        style={{
          width: fill ? undefined : width,
          height: fill ? undefined : height,
        }}
      />
    );
  }

  const commonProps = {
    alt,
    onError: () => setImageError(true),
    onLoad: () => setIsLoading(false),
    className: cn(
      className,
      isLoading && "opacity-0", // Hide while loading
      "transition-opacity duration-50"
    ),
    priority,
  };

  if (fill) {
    return (
      <>
        {/* Loading placeholder */}
        {isLoading && (
          <PhonePlaceholder className="pointer-events-none absolute inset-0 bg-transparent" />
        )}
        <Image
          {...commonProps}
          src={src}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          alt={alt}
        />
      </>
    );
  }

  return (
    <>
      {/* Loading placeholder */}
      {isLoading && (
        <PhonePlaceholder
          className="pointer-events-none absolute bg-transparent"
          style={{ width, height }}
        />
      )}
      <Image
        {...commonProps}
        src={src}
        width={width}
        height={height}
        alt={alt}
      />
    </>
  );
};
