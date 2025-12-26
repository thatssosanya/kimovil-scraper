import { cn } from "@/src/utils/cn";
import { useId } from "react";

type RankBadgeSize = "small" | "default" | "large";

interface RankBadgeProps {
  rank: number;
  size?: RankBadgeSize;
  className?: string;
}

const dimensions: Record<
  RankBadgeSize,
  { size: number; fontSize: number; strokeWidth: number; curveWidth: number }
> = {
  small: { size: 32, fontSize: 16, strokeWidth: 2, curveWidth: 1.5 },
  default: { size: 40, fontSize: 20, strokeWidth: 2.5, curveWidth: 2 },
  large: { size: 56, fontSize: 28, strokeWidth: 3, curveWidth: 2.5 },
};

export const RankBadge = ({
  rank,
  size = "default",
  className,
}: RankBadgeProps) => {
  const uid = useId();
  const dim = dimensions[size];
  const radius = dim.size / 2 - dim.strokeWidth / 2;
  const center = dim.size / 2;

  const curveY = center + radius * 0.57;
  const curveOffset = dim.size * 0.15;
  const curveControl = curveY + 3;

  const getSolidColor = () => {
    if (rank === 1) return "#c69d3b";
    if (rank === 2) return "#969696";
    if (rank === 3) return "#b5693d";
    return undefined;
  };

  return (
    <svg
      width={dim.size}
      height={dim.size}
      viewBox={`0 0 ${dim.size} ${dim.size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0 overflow-visible", className)}
    >
      <defs>
        {rank === 1 && (
          <>
            <linearGradient
              id={`grad-${uid}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#f9d77e" />
              <stop offset="30%" stopColor="#e6be5a" />
              <stop offset="60%" stopColor="#d4a942" />
              <stop offset="100%" stopColor="#c69d3b" />
            </linearGradient>
            <radialGradient id={`inner-${uid}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor="#fff5d6" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#c69d3b" stopOpacity={0} />
            </radialGradient>
          </>
        )}
        {rank === 2 && (
          <>
            <linearGradient
              id={`grad-${uid}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#e8e8e8" />
              <stop offset="30%" stopColor="#c5c5c5" />
              <stop offset="60%" stopColor="#a8a8a8" />
              <stop offset="100%" stopColor="#969696" />
            </linearGradient>
            <radialGradient id={`inner-${uid}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#969696" stopOpacity={0} />
            </radialGradient>
          </>
        )}
        {rank === 3 && (
          <>
            <linearGradient
              id={`grad-${uid}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#e5b08a" />
              <stop offset="30%" stopColor="#cd7f52" />
              <stop offset="60%" stopColor="#b5693d" />
              <stop offset="100%" stopColor="#9d5a33" />
            </linearGradient>
            <radialGradient id={`inner-${uid}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor="#f5d4b8" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#9d5a33" stopOpacity={0} />
            </radialGradient>
          </>
        )}
        {rank >= 4 && rank <= 5 && (
          <linearGradient id={`grad-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#d1d5db" />
            <stop offset="100%" stopColor="#6b7280" />
          </linearGradient>
        )}
      </defs>

      {/* Base Background */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        className="fill-white transition-colors duration-200 dark:fill-zinc-800"
      />

      {rank <= 3 ? (
        <>
          {/* Podium Medals (1-3) */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#grad-${uid})`}
            strokeWidth={dim.strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill={`url(#inner-${uid})`}
            opacity={rank === 1 ? 0.4 : rank === 2 ? 0.3 : 0.35}
          />
          <text
            x={center}
            y={center}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={dim.fontSize}
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-zinc-900 dark:fill-zinc-100"
          >
            {rank}
          </text>
          {/* Decorative curve under number */}
          <path
            d={`M ${center - curveOffset} ${curveY} Q ${center} ${curveControl} ${center + curveOffset} ${curveY}`}
            fill="none"
            stroke={getSolidColor()}
            strokeWidth={dim.curveWidth}
            strokeLinecap="round"
          />
        </>
      ) : rank <= 5 ? (
        <>
          {/* Runners Up (4-5) - Steel Look */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#grad-${uid})`}
            strokeWidth={dim.strokeWidth}
          />
          <text
            x={center}
            y={center}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={dim.fontSize}
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-zinc-700 dark:fill-zinc-300"
          >
            {rank}
          </text>
        </>
      ) : (
        <>
          {/* Rest of the pack (6+) - Minimalist */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-600"
            strokeWidth={dim.strokeWidth}
          />
          <text
            x={center}
            y={center}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={dim.fontSize}
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-zinc-500 dark:fill-zinc-400"
          >
            {rank}
          </text>
        </>
      )}
    </svg>
  );
};
