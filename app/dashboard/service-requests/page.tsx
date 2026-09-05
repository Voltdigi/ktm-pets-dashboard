"use client"

import { useMemo, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { getLinkedBookingsForRequest, resolveBookingDetails } from "@/lib/airtable-joins"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ServiceRequestCard } from "@/components/service-request-card"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/search-input"
import { SelectDropdown } from "@/components/select-dropdown"
import { useListControls, type SortOption } from "@/hooks/useListControls"
import { getStatusColor, DEFAULT_STATUS, STATUS_OPTIONS } from "@/lib/service-request-status"
import {
  formatCurrency,
  formatDate,
  getDaysPending,
  getPaymentStatus,
  formatAddress,
} from "@/lib/service-request-formatting"
import {
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiCheckLine,
  RiAlertLine,
} from "@remixicon/react"

interface AirtableRecord {
  id: string
  fields: Record<string, any>
}

interface ServiceRequestRow {
  record: AirtableRecord
  clientName: string
  email?: string
  serviceType: string
  displayDate: string
  dateSort: string
  status: string
  invoiceLink?: string
  totalPrice?: number
  depositAmount?: number
  daysPending: number | null
  address: string
  petNames?: string
  paymentStatus: {
    text: string
    percentage: number
    isOverdue: boolean
  }
}

function ServiceRequestsContent() {
  const searchParams = useSearchParams()
  const statusFromUrl = searchParams.get("status")

  const {
    serviceRequests,
    bookings,
    isLoading: serviceRequestsLoading,
    error: serviceRequestsError,
    refreshServiceRequests,
    serviceRequestsById,
    petsByClientId,
    bookingsByRequestId,
  } = useDashboardData()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all")

  const toggleExpanded = (recordId: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(recordId)) {
      newSet.delete(recordId)
    } else {
      newSet.add(recordId)
    }
    setExpandedIds(newSet)
  }

  const getEarliestBookingDate = (requestId: string): string | null => {
    // Use O(1) lookup instead of O(n) filter
    const linkedBookings = bookingsByRequestId.get(requestId) ?? []

    if (linkedBookings.length === 0) return null

    const dates = linkedBookings
      .map((booking: any) => booking.fields["Date"])
      .filter((date: string) => date && date !== "")
      .sort()

    return dates.length > 0 ? dates[0] : null
  }

  const getLinkedBookings = (requestId: string) => {
    // Use O(1) lookup instead of O(n) filter
    return bookingsByRequestId.get(requestId) ?? []
  }

  // Compute pet names for all service requests in-memory (no async fetch).
  const petNamesByRequest = useMemo(() => {
    const result: Record<string, string> = {}

    for (const request of serviceRequests) {
      const linkedBookings = getLinkedBookingsForRequest(bookings, request.id)
      if (linkedBookings.length > 0) {
        const resolved = resolveBookingDetails(linkedBookings[0], {
          serviceRequestsById,
          petsByClientId,
        })
        result[request.id] = resolved.pets
      }
    }

    return result
  }, [serviceRequests, bookings, serviceRequestsById, petsByClientId])

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
        refreshServiceRequests()
      }, 1000)

      return result
    } catch (error) {
      throw error
    }
  }

  const loading = serviceRequestsLoading
  const error = serviceRequestsError

  const rows: ServiceRequestRow[] = useMemo(
    () =>
      serviceRequests.map((request) => {
        const submittedDate = request.fields["Submitted Date"] || "—"
        const earliestBookingDate = getEarliestBookingDate(request.id)
        const totalPrice = request.fields["Total Price"]
        const depositAmount = request.fields["Deposit Amount"]
        const status = request.fields["Status"] || DEFAULT_STATUS
        const daysPending = getDaysPending(request.fields["Submitted Date"])

        return {
          record: request,
          clientName: request.fields["Client Name"] || "Unknown",
          email: request.fields["Email"],
          serviceType: request.fields["Service Type"] || "—",
          displayDate: earliestBookingDate ? formatDate(earliestBookingDate) : formatDate(submittedDate),
          dateSort: request.fields["Submitted Date"] || "",
          status,
          invoiceLink: request.fields["Square Invoice Link"],
          totalPrice,
          depositAmount,
          daysPending,
          address: formatAddress(request.fields),
          petNames: petNamesByRequest[request.id],
          paymentStatus: getPaymentStatus(depositAmount, totalPrice, status),
        }
      }),
    [serviceRequests, bookingsByRequestId, petNamesByRequest]
  )

  const sortOptions: SortOption<ServiceRequestRow>[] = [
    { value: "date-desc", label: "Date Submitted (Newest)", compare: (a, b) => b.dateSort.localeCompare(a.dateSort) },
    { value: "date-asc", label: "Date Submitted (Oldest)", compare: (a, b) => a.dateSort.localeCompare(b.dateSort) },
    { value: "name-asc", label: "Client Name (A–Z)", compare: (a, b) => a.clientName.localeCompare(b.clientName) },
    { value: "name-desc", label: "Client Name (Z–A)", compare: (a, b) => b.clientName.localeCompare(a.clientName) },
  ]

  const statusFilterOptions = [
    { value: "all", label: "All Statuses" },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
  ]

  // Get unique service types for filter options
  const uniqueServiceTypes = useMemo(() => {
    const types = new Set(rows.map((r) => r.serviceType).filter((type) => type !== "—"))
    return Array.from(types).sort()
  }, [rows])

  const serviceTypeFilterOptions = [
    { value: "all", label: "All Service Types" },
    ...uniqueServiceTypes.map((type) => ({ value: type, label: type })),
  ]

  const { search, setSearch, filterValue, setFilterValue, sortValue, setSortValue, filteredData: statusFilteredData } =
    useListControls({
      data: rows,
      getSearchableValues: (r) => [r.clientName, r.serviceType, r.displayDate, r.status],
      sortOptions,
      defaultSortValue: "date-desc",
      getFilterValue: (r) => r.status,
    })

  // Initialize status filter from URL parameter
  useEffect(() => {
    if (statusFromUrl) {
      setFilterValue(statusFromUrl)
    }
  }, [statusFromUrl, setFilterValue])

  // Apply service type filter on top of status filter
  const filteredData = useMemo(() => {
    if (serviceTypeFilter === "all") {
      return statusFilteredData
    }
    return statusFilteredData.filter((row) => row.serviceType === serviceTypeFilter)
  }, [statusFilteredData, serviceTypeFilter])

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
              onClick={refreshServiceRequests}
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
              <p className="text-sm mt-1">{error instanceof Error ? error.message : String(error)}</p>
            </div>
          )}

          {!loading && !error && serviceRequests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No service requests found
            </div>
          )}

          {!loading && !error && serviceRequests.length > 0 && (
            <div className="space-y-3">
              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                {/* Search Control */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Search</label>
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Client, service, date..."
                    className="w-full"
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Status</label>
                  <SelectDropdown
                    value={filterValue}
                    onValueChange={setFilterValue}
                    options={statusFilterOptions}
                    placeholder="All Statuses"
                  />
                </div>

                {/* Service Type Filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Service Type</label>
                  <SelectDropdown
                    value={serviceTypeFilter}
                    onValueChange={setServiceTypeFilter}
                    options={serviceTypeFilterOptions}
                    placeholder="All Service Types"
                  />
                </div>

                {/* Sort Control */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Sort By</label>
                  <SelectDropdown
                    value={sortValue}
                    onValueChange={setSortValue}
                    options={sortOptions.map(({ value, label }) => ({ value, label }))}
                    placeholder="Date Submitted (Newest)"
                  />
                </div>
              </div>

              {/* Header Row */}
              <div className="sticky top-16 bg-background/95 backdrop-blur-sm border-b border-border/40 p-4 z-10">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Client</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Service</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Status</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Payment</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Address</div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Actions</div>
                  </div>
                </div>
              </div>

              {filteredData.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No service requests match your search/filters
                </div>
              )}

              {filteredData.map((row) => {
                const request = row.record
                const isExpanded = expandedIds.has(request.id)

                return (
                  <div key={request.id} className={`border rounded-lg overflow-hidden transition-colors ${
                    isExpanded
                      ? "border-border bg-secondary/20"
                      : "border-border/40 hover:border-border/60 hover:bg-secondary/30"
                  }`}>
                    {/* Summary Row */}
                    <div
                      onClick={() => toggleExpanded(request.id)}
                      className="p-4 cursor-pointer"
                    >
                      <div className="grid grid-cols-12 gap-4 items-start">
                        {/* Client Name */}
                        <div className="col-span-2 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {row.clientName}
                          </p>
                          {row.email && (
                            <p className="text-xs text-foreground/60 truncate">
                              {row.email}
                            </p>
                          )}
                        </div>

                        {/* Service Type */}
                        <div className="col-span-2 min-w-0">
                          <p className="text-sm text-foreground/80">{row.serviceType}</p>
                          <p className="text-xs text-foreground/50">{row.displayDate}</p>
                        </div>

                        {/* Status */}
                        <div className="col-span-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}>
                            {row.status}
                          </span>
                          {row.daysPending !== null && (
                            <p className="text-xs text-foreground/50 mt-1">
                              {row.daysPending} days pending
                            </p>
                          )}
                        </div>

                        {/* Payment Status */}
                        <div className="col-span-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              {row.paymentStatus.isOverdue && (
                                <RiAlertLine className="w-3 h-3 text-red-500" />
                              )}
                              <p className="text-sm font-medium text-foreground">
                                {row.totalPrice ? formatCurrency(row.totalPrice) : "—"}
                              </p>
                            </div>
                            <p className="text-xs text-foreground/60">
                              {row.paymentStatus.text}
                            </p>
                          </div>
                        </div>

                        {/* Address */}
                        <div className="col-span-2">
                          <p className="text-sm text-foreground/80 truncate" title={row.address}>
                            {row.address}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="col-span-2 flex justify-end items-start gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!row.invoiceLink}
                            onClick={(e) => {
                              e.stopPropagation()
                              row.invoiceLink && window.open(row.invoiceLink, '_blank')
                            }}
                            title={row.invoiceLink ? "Open invoice" : "No invoice link available"}
                          >
                            <RiExternalLinkLine className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!row.invoiceLink}
                            onClick={(e) => {
                              e.stopPropagation()
                              row.invoiceLink && copyToClipboard(row.invoiceLink, request.id)
                            }}
                            title={row.invoiceLink ? "Copy invoice link" : "No invoice link available"}
                          >
                            {copiedId === request.id ? (
                              <RiCheckLine className="w-4 h-4 text-green-600" />
                            ) : (
                              <RiFileCopyLine className="w-4 h-4" />
                            )}
                          </Button>
                          {isExpanded ? (
                            <RiArrowUpSLine className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <RiArrowDownSLine className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-border bg-secondary/10 p-6">
                        <ServiceRequestCard
                          record={request}
                          onStatusUpdate={handleStatusUpdate}
                          petNames={row.petNames}
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

export default function ServiceRequestsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ServiceRequestsContent />
    </Suspense>
  )
}
