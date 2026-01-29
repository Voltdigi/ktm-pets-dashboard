"use client"

import { useState } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { DataTabs } from "@/components/data-tabs"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RiRefreshLine } from "@remixicon/react"

const TABLE_TABS = [
  { id: "clients", label: "Clients", tableId: process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID || "" },
  { id: "pets", label: "Pets", tableId: process.env.NEXT_PUBLIC_PETS_TABLE_ID || "" },
  { id: "services", label: "Service Requests", tableId: process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID || "" },
  { id: "bookings", label: "Confirmed Bookings", tableId: process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID || "" },
]
export default function DashboardPage() {
  const [activeTabId, setActiveTabId] = useState("clients")
  const activeTab = TABLE_TABS.find((tab) => tab.id === activeTabId) || TABLE_TABS[0]
  const { data, loading, error, refetch } = useAirtableData(activeTab.tableId)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back!</p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold">Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Floating Sidebar */}
      <FloatingSidebar />

      {/* Main Content */}
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Data Viewer Card */}
          <Card className="min-h-96">
            <div className="flex items-center justify-between px-6 pt-6 pb-0 mb-6">
              <h2 className="text-xl font-semibold">Database</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                disabled={loading}
              >
                <RiRefreshLine className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <DataTabs
              tabs={TABLE_TABS}
              activeTab={activeTabId}
              onTabChange={setActiveTabId}
            />

            <CardContent className="p-6">
              {loading && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading {activeTab.label.toLowerCase()}...
                </div>
              )}

              {error && (
                <div className="text-center py-8 text-red-600 dark:text-red-400">
                  <p className="font-medium">Error loading data</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}

              {!loading && !error && data.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab.label.toLowerCase()} found
                </div>
              )}

              {!loading && !error && data.length > 0 && (
                <div className="space-y-3 overflow-y-auto max-h-96">
                  {data.map((record) => (
                    <div
                      key={record.id}
                      className="p-4 border border-border/40 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <div className="space-y-2">
                        {Object.entries(record.fields).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-foreground/70">
                              {key}:
                            </span>
                            <span className="ml-2 text-foreground">
                              {typeof value === "object"
                                ? JSON.stringify(value)
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}