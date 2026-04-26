"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-zinc-900 data-[state=on]:text-zinc-50",
  {
    variants: {
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export function Toggle({
  className,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ size, className }))}
      {...props}
    />
  );
}

