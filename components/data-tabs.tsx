"use client"

import { cn } from "@/lib/utils"

export interface Tab {
  id: string
  label: string
  tableId: string
}

interface DataTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function DataTabs({ tabs, activeTab, onTabChange }: DataTabsProps) {
  return (
    <div className="flex gap-2 border-b border-border/40">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-4 py-3 text-sm font-medium transition-colors duration-200 border-b-2 border-transparent",
            activeTab === tab.id
              ? "border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
