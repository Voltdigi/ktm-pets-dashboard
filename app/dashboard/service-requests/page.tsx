"use client"

import { useState } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ServiceRequestCard } from "@/components/service-request-card"
import { Button } from "@/components/ui/button"
import { getStatusColor, DEFAULT_STATUS } from "@/lib/service-request-status"
import {
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiCheckLine,
} from "@remixicon/react"

interface AirtableRecord {
  id: string
  fields: Record<string, any>
}

export default function ServiceRequestsPage() {
  const { data: serviceRequests, loading: serviceRequestsLoading, error: serviceRequestsError, refetch: refetchServiceRequests } = useAirtableData(
    process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID || ""
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const toggleExpanded = (recordId: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(recordId)) {
      newSet.delete(recordId)
    } else {
      newSet.add(recordId)
    }
    setExpandedIds(newSet)
  }

  const copyToClipboard = (text: string, recordId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(recordId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleStatusUpdate = async (recordId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/square/update-service-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId,
          newStatus,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to update status")
      }

      // Refresh data after successful update
      setTimeout(() => {
        refetchServiceRequests()
      }, 1000)

      return result
    } catch (error) {
      throw error
    }
  }

  const loading = serviceRequestsLoading
  const error = serviceRequestsError

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight pl-8">Service Requests</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold pl-8">Service Requests</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetchServiceRequests}
              disabled={loading}
            >
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
        <div className="mx-auto max-w-6xl">
          {loading && (
            <div className="text-center py-12 text-muted-foreground">
              Loading service requests...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              <p className="font-medium">Error loading data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && serviceRequests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No service requests found
            </div>
          )}

          {!loading && !error && serviceRequests.length > 0 && (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="sticky top-16 bg-background/95 backdrop-blur-sm border-b border-border/40 p-4 flex items-center gap-4 z-10">
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Client Name</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Service Type</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Date Submitted</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Status</div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Invoice</div>
                </div>
              </div>

              {serviceRequests.map((request) => {
                const isExpanded = expandedIds.has(request.id)
                const clientName = request.fields["Client Name"] || "Unknown"
                const serviceType = request.fields["Service Type"] || "—"
                const submittedDate = request.fields["Submitted Date"] || "—"
                const createdTime = request.fields["Created"] ? new Date(request.fields["Created"]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ""
                const date = createdTime ? `${submittedDate} ${createdTime}` : submittedDate
                const status = request.fields["Status"] || DEFAULT_STATUS

                // Fields to hide from expanded detail
                const summaryFields = [
                  "Client Name",
                  "Service Type",
                  "Submitted Date",
                  "Status",
                ]

                const invoiceLink = request.fields["Square Invoice Link"]

                return (
                  <div key={request.id} className="border border-border/40 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <div
                      onClick={() => toggleExpanded(request.id)}
                      className="bg-card hover:bg-secondary/50 transition-colors p-4 flex items-center gap-4 cursor-pointer"
                    >
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div className="text-sm font-medium">{clientName}</div>
                        <div className="text-sm">{serviceType}</div>
                        <div className="text-sm">{date}</div>
                        <div className="text-sm">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                            {status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!invoiceLink}
                            onClick={(e) => {
                              e.stopPropagation()
                              invoiceLink && window.open(invoiceLink, '_blank')
                            }}
                            title={invoiceLink ? "Open invoice" : "No invoice link available"}
                          >
                            <RiExternalLinkLine className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!invoiceLink}
                            onClick={(e) => {
                              e.stopPropagation()
                              invoiceLink && copyToClipboard(invoiceLink, request.id)
                            }}
                            title={invoiceLink ? "Copy invoice link" : "No invoice link available"}
                          >
                            {copiedId === request.id ? (
                              <RiCheckLine className="w-4 h-4 text-green-600" />
                            ) : (
                              <RiFileCopyLine className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {isExpanded ? (
                          <RiArrowUpSLine className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <RiArrowDownSLine className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-secondary/20 p-4 space-y-4">
                        <ServiceRequestCard
                          record={request}
                          onStatusUpdate={handleStatusUpdate}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
