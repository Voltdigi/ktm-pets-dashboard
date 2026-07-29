"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { STATUS_OPTIONS, DEFAULT_STATUS, getStatusStyle } from "@/lib/service-request-status"
import {
  RiRefreshLine,
  RiFileListLine,
  RiTimeLine,
  RiSecurePaymentLine,
  RiShieldCheckLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiArrowRightLine,
} from "@remixicon/react"

const STATUS_ICONS: Record<string, React.ElementType> = {
  "Pending Review": RiTimeLine,
  "Payment Pending": RiSecurePaymentLine,
  "Deposit Paid": RiShieldCheckLine,
  "Full Paid": RiCheckboxCircleLine,
  Rejected: RiCloseCircleLine,
}

export default function DashboardPage() {
  const {
    data: serviceRequests,
    loading,
    error,
    refetch,
  } = useAirtableData(process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID || "")

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const status of STATUS_OPTIONS) counts[status] = 0

    for (const request of serviceRequests) {
      const status = request.fields["Status"] || DEFAULT_STATUS
      counts[status] = (counts[status] || 0) + 1
    }

    return counts
  }, [serviceRequests])

  const total = serviceRequests.length

  const recentRequests = useMemo(() => {
    return [...serviceRequests]
      .sort((a, b) => {
        const aTime = a.fields["Created"] ? new Date(a.fields["Created"]).getTime() : 0
        const bTime = b.fields["Created"] ? new Date(b.fields["Created"]).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 8)
  }, [serviceRequests])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight pl-8">KTM Dashboard</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold pl-8">KTM Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
              <RiRefreshLine className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Floating Sidebar */}
      <FloatingSidebar />

      {/* Main Content */}
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Service Requests Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A snapshot of every service request by status
            </p>
          </div>

          {error && (
            <Card>
              <CardContent className="text-center py-8 text-red-600 dark:text-red-400">
                <p className="font-medium">Error loading data</p>
                <p className="text-sm mt-1">{error}</p>
              </CardContent>
            </Card>
          )}

          {!error && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <Card>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RiFileListLine className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Total</span>
                    </div>
                    <span className="text-3xl font-semibold tabular-nums">
                      {loading ? "—" : total}
                    </span>
                  </CardContent>
                </Card>

                {STATUS_OPTIONS.map((status) => {
                  const Icon = STATUS_ICONS[status]
                  return (
                    <Card key={status}>
                      <CardContent className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-medium uppercase tracking-wide">
                            {status}
                          </span>
                        </div>
                        <span className="text-3xl font-semibold tabular-nums">
                          {loading ? "—" : statusCounts[status]}
                        </span>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Status Breakdown */}
              <Card>
                <CardContent className="space-y-4">
                  <h3 className="text-sm font-semibold">Status Breakdown</h3>

                  {loading ? (
                    <div className="text-sm text-muted-foreground py-4">Loading breakdown...</div>
                  ) : total === 0 ? (
                    <div className="text-sm text-muted-foreground py-4">
                      No service requests yet
                    </div>
                  ) : (
                    <>
                      <div className="flex w-full h-3 rounded-full overflow-hidden bg-secondary">
                        {STATUS_OPTIONS.map((status) => {
                          const count = statusCounts[status]
                          if (count === 0) return null
                          const width = (count / total) * 100
                          return (
                            <div
                              key={status}
                              className={`h-full ${getStatusStyle(status).bar} first:rounded-l-full last:rounded-r-full`}
                              style={{ width: `${width}%` }}
                              title={`${status}: ${count}`}
                            />
                          )
                        })}
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {STATUS_OPTIONS.map((status) => (
                          <div key={status} className="flex items-center gap-2 text-sm">
                            <span
                              className={`inline-block w-2.5 h-2.5 rounded-full ${getStatusStyle(status).dot}`}
                            />
                            <span className="text-foreground/80">{status}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {statusCounts[status]} (
                              {total > 0 ? Math.round((statusCounts[status] / total) * 100) : 0}
                              %)
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recent Service Requests */}
              <Card>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Recent Service Requests</h3>
                    <Link href="/dashboard/service-requests">
                      <Button variant="outline" size="sm">
                        View all
                        <RiArrowRightLine className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  {loading && (
                    <div className="text-sm text-muted-foreground py-4">Loading requests...</div>
                  )}

                  {!loading && recentRequests.length === 0 && (
                    <div className="text-sm text-muted-foreground py-4">
                      No service requests yet
                    </div>
                  )}

                  {!loading && recentRequests.length > 0 && (
                    <div className="space-y-2">
                      {recentRequests.map((request) => {
                        const status = request.fields["Status"] || DEFAULT_STATUS
                        const clientName = request.fields["Client Name"] || "Unknown"
                        const serviceType = request.fields["Service Type"] || "—"
                        const submittedDate = request.fields["Submitted Date"] || "—"

                        return (
                          <div
                            key={request.id}
                            className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/40 hover:bg-secondary/50 transition-colors"
                          >
                            <div className="min-w-0 flex-1 grid grid-cols-3 gap-4">
                              <span className="text-sm font-medium truncate">{clientName}</span>
                              <span className="text-sm text-muted-foreground truncate">
                                {serviceType}
                              </span>
                              <span className="text-sm text-muted-foreground truncate">
                                {submittedDate}
                              </span>
                            </div>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusStyle(status).badge}`}
                            >
                              {status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
