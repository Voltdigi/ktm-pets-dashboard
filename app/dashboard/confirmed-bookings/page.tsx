"use client"

import { useState, useMemo, Suspense, lazy } from "react"
import { useDashboardData } from "@/contexts/dashboard-data-context"
import { resolveBookingDetails } from "@/lib/airtable-joins"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RiRefreshLine,
  RiCloseLine,
  RiCalendarLine,
} from "@remixicon/react"

// Lazy load calendar grid for better first paint performance
const CalendarGrid = lazy(() =>
  import("@/components/calendar-grid").then((mod) => ({
    default: mod.CalendarGrid,
  }))
)

interface Booking {
  id: string
  fields: {
    "Date": string
    "Time": string
    "Service Type": string
    "Duration": string
    "Request ID": string[]
    [key: string]: any
  }
}

interface BookingDisplay {
  id: string
  date: string
  serviceType: string
  time: string
  duration: string
  petNames: string
  fields: Record<string, any>
}

export default function ConfirmedBookingsPage() {
  const {
    bookings,
    serviceRequestsById,
    petsByClientId,
    isLoading: loading,
    error,
    refreshBookings,
  } = useDashboardData()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState<BookingDisplay | null>(null)

  // Resolve the selected booking's details (service request, client info, address)
  const selectedBookingResolved = useMemo(() => {
    if (!selectedBooking) return null
    // Find the full booking record by ID
    const fullBooking = bookings.find(b => b.id === selectedBooking.id)
    if (!fullBooking) return null
    return resolveBookingDetails(fullBooking, {
      serviceRequestsById,
      petsByClientId,
    })
  }, [selectedBooking, bookings, serviceRequestsById, petsByClientId])

  // Compute bookings by date and resolve pet names in-memory (no async fetch).
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingDisplay[]>()

    for (const booking of bookings) {
      const date = booking.fields["Date"]
      if (!date) continue

      const resolved = resolveBookingDetails(booking, {
        serviceRequestsById,
        petsByClientId,
      })

      const display: BookingDisplay = {
        id: booking.id,
        date,
        serviceType: booking.fields["Service Type"] || "Service",
        time: booking.fields["Time"] || "TBD",
        duration: booking.fields["Duration"] || "",
        petNames: resolved.pets,
        fields: booking.fields,
      }

      if (!map.has(date)) {
        map.set(date, [])
      }
      map.get(date)!.push(display)
    }

    return map
  }, [bookings, serviceRequestsById, petsByClientId])

  // Helper to format date as YYYY-MM-DD
  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight pl-8">Confirmed Bookings</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold pl-8">Bookings</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const calendarUrl = `${window.location.origin}/api/calendar`;
                const webcalUrl = calendarUrl.replace('https://', 'webcal://').replace('http://', 'webcal://');
                window.location.href = webcalUrl;
              }}
              title="Subscribe to Apple Calendar"
            >
              <RiCalendarLine className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBookings}
              disabled={loading}
            >
              <RiRefreshLine className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <FloatingSidebar />

      <main className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="p-4">
            {error && (
              <div className="text-center py-8 text-red-600 dark:text-red-400 mb-6">
                <p className="font-medium">Error loading bookings</p>
                <p className="text-sm mt-1">{error instanceof Error ? error.message : String(error)}</p>
              </div>
            )}

            {/* Lazy load calendar grid to improve first paint performance */}
            <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading calendar...</div>}>
              <CalendarGrid
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                bookingsByDate={bookingsByDate}
                onSelectBooking={setSelectedBooking}
              />
            </Suspense>

            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading bookings...
              </div>
            )}

            {!loading && !error && bookings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground mt-6">
                No confirmed bookings found
              </div>
            )}
          </Card>
        </div>
      </main>

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-border/40 bg-background">
              <h3 className="text-lg font-semibold">Booking Details</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedBooking(null)}
                className="h-8 w-8"
              >
                <RiCloseLine className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Service</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      Service Type
                    </div>
                    <div className="text-sm">
                      {selectedBooking.serviceType}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      Duration
                    </div>
                        <div className="text-sm">
                          {selectedBooking.duration || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Date
                        </div>
                        <div className="text-sm">
                          {new Date(selectedBooking.date + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Time
                        </div>
                        <div className="text-sm">{selectedBooking.time}</div>
                      </div>
                    </div>
                  </div>

                  {selectedBookingResolved?.serviceRequest && (
                    <div className="space-y-4 border-t border-border/40 pt-6">
                      <h4 className="font-semibold text-foreground">Client</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Name
                          </div>
                          <div className="text-sm">
                            {selectedBookingResolved.serviceRequest["Client Name"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Email
                          </div>
                          <div className="text-sm">
                            {selectedBookingResolved.serviceRequest["Email"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Phone
                          </div>
                          <div className="text-sm">
                            {selectedBookingResolved.serviceRequest["Phone Number"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Pets
                          </div>
                          <div className="text-sm">
                            {selectedBooking.petNames || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBookingResolved?.address && (
                    <div className="space-y-4 border-t border-border/40 pt-6">
                      <h4 className="font-semibold text-foreground">Location</h4>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Address
                        </div>
                        <div className="text-sm">
                          {selectedBookingResolved.address}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 border-t border-border/40 pt-6">
                    <h4 className="font-semibold text-foreground">Booking Fields</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {Object.entries(selectedBooking.fields).map(([key, value]) => (
                        <div key={key} className="text-sm">
                          <div className="font-medium text-foreground/70">{key}</div>
                          <div className="text-foreground break-words text-xs">
                            {typeof value === "object"
                              ? JSON.stringify(value, null, 2)
                              : String(value || "—")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
