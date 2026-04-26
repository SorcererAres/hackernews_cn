"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ViewOriginal(props: { label: string; html: string }) {
  const { label, html } = props;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 overflow-auto">
        <div
          className="prose-hn text-sm leading-6 text-zinc-900"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </PopoverContent>
    </Popover>
  );
}

