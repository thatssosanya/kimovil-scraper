"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/src/lib/utils"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // Neutral, subtle tooltip styling (no brand color, no animation)
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md border px-3 py-1.5 text-xs text-balance shadow-lg",
          // Light mode
          "border-gray-800 bg-gray-900/95 text-gray-100",
          // Dark mode
          "dark:border-gray-700 dark:bg-[hsl(0_0%_9%)] dark:text-[hsl(0_0%_85%)]",
          // Disable default animations to avoid flicker/dots
          "animate-none data-[state=closed]:animate-none",
          className
        )}
        {...props}
      >
        {children}
        {/* Hide arrow by default to avoid stray colored dot; consumers can override via className if needed */}
        <TooltipPrimitive.Arrow className="hidden" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
