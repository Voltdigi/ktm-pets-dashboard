"use client"

import { useMemo, useState, useEffect } from "react"
import { useAirtableData } from "@/hooks/useClients"
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

export default function ServiceRequestsPage() {
  const { data: serviceRequests, loading: serviceRequestsLoading, error: serviceRequestsError, refetch: refetchServiceRequests } = useAirtableData(
    process.env.NEXT_PUBLIC_SERVICE_REQUESTS_TABLE_ID || ""
  )
  const { data: bookings } = useAirtableData(
    process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID || ""
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [petNamesByRequest, setPetNamesByRequest] = useState<Record<string, string>>({})

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
    if (!bookings || bookings.length === 0) return null

    const linkedBookings = bookings.filter((booking: any) => {
      const requestIds = booking.fields["Request ID"]
      if (!requestIds) return false
      const idsArray = Array.isArray(requestIds) ? requestIds : [requestIds]
      return idsArray.includes(requestId)
    })

    if (linkedBookings.length === 0) return null

    const dates = linkedBookings
      .map((booking: any) => booking.fields["Date"])
      .filter((date: string) => date && date !== "")
      .sort()

    return dates.length > 0 ? dates[0] : null
  }

  const getLinkedBookings = (requestId: string) => {
    if (!bookings || bookings.length === 0) return []

    return bookings.filter((booking: any) => {
      const requestIds = booking.fields["Request ID"]
      if (!requestIds) return false
      const idsArray = Array.isArray(requestIds) ? requestIds : [requestIds]
      return idsArray.includes(requestId)
    })
  }

  // Fetch pet names for all service requests in parallel
  useEffect(() => {
    const fetchAllPetNames = async () => {
      const petNames: Record<string, string> = {}

      const fetchPromises = serviceRequests
        .map(async (request) => {
          const linkedBookings = getLinkedBookings(request.id)
          if (linkedBookings.length > 0) {
            try {
              const response = await fetch("/api/bookings/details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookingId: linkedBookings[0].id }),
              })
              const data = await response.json()
              if (data.pets) {
                petNames[request.id] = data.pets
              }
            } catch (error) {
              console.error(`Error fetching pet names for request ${request.id}:`, error)
            }
          }
          return { id: request.id, petName: petNames[request.id] }
        })

      await Promise.all(fetchPromises)
      setPetNamesByRequest(petNames)
    }

    if (serviceRequests.length > 0 && bookings.length > 0) {
      fetchAllPetNames()
    }
  }, [serviceRequests, bookings])

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
          dateSort: earliestBookingDate || request.fields["Submitted Date"] || "",
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
    [serviceRequests, bookings, petNamesByRequest]
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

  const { search, setSearch, filterValue, setFilterValue, sortValue, setSortValue, filteredData } =
    useListControls({
      data: rows,
      getSearchableValues: (r) => [r.clientName, r.serviceType, r.displayDate, r.status],
      sortOptions,
      defaultSortValue: "date-desc",
      getFilterValue: (r) => r.status,
    })

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
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search service requests..."
                  className="sm:max-w-xs"
                />
                <SelectDropdown
                  value={filterValue}
                  onValueChange={setFilterValue}
                  options={statusFilterOptions}
                  placeholder="Status"
                />
                <SelectDropdown
                  value={sortValue}
                  onValueChange={setSortValue}
                  options={sortOptions.map(({ value, label }) => ({ value, label }))}
                  placeholder="Sort by"
                />
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
                          bookings={bookings}
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
