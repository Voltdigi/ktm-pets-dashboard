"use client"

import { useState, useEffect } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiRefreshLine,
  RiCloseLine,
} from "@remixicon/react"

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
  fields: Record<string, any>
}

export default function ConfirmedBookingsPage() {
  const { data: bookings, loading, error, refetch } = useAirtableData(
    process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID || ""
  )

  const [currentDate, setCurrentDate] = useState(new Date())
  const [bookingsByDate, setBookingsByDate] = useState<Map<string, BookingDisplay[]>>(new Map())
  const [selectedBooking, setSelectedBooking] = useState<BookingDisplay | null>(null)
  const [bookingDetails, setBookingDetails] = useState<any>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    const map = new Map<string, BookingDisplay[]>()

    bookings.forEach((booking: Booking) => {
      const date = booking.fields["Date"]
      if (date) {
        const display: BookingDisplay = {
          id: booking.id,
          date,
          serviceType: booking.fields["Service Type"] || "Service",
          time: booking.fields["Time"] || "TBD",
          duration: booking.fields["Duration"] || "",
          fields: booking.fields,
        }

        if (!map.has(date)) {
          map.set(date, [])
        }
        map.get(date)!.push(display)
      }
    })

    setBookingsByDate(map)
  }, [bookings])

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = []
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
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
              onClick={refetch}
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
      <main className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Card className="p-4">
            {error && (
              <div className="text-center py-8 text-red-600 dark:text-red-400 mb-6">
                <p className="font-medium">Error loading bookings</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={previousMonth}
              >
                <RiArrowLeftSLine className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-semibold">{monthName}</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={nextMonth}
              >
                <RiArrowRightSLine className="w-4 h-4" />
              </Button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 bg-secondary/20 p-0.5 rounded-lg">
              {days.map((day, index) => {
                const dateStr = day
                  ? formatDate(year, month, day)
                  : null
                const dayBookings = dateStr ? bookingsByDate.get(dateStr) : []

                return (
                  <div
                    key={index}
                    className={`min-h-24 p-1 rounded border transition-colors text-xs ${
                      day
                        ? "bg-card border-border/40 hover:bg-secondary/50"
                        : "bg-transparent border-transparent"
                    }`}
                  >
                    {day && (
                      <>
                        <div className="text-xs font-semibold mb-1 text-foreground">
                          {day}
                        </div>
                        <div className="space-y-0.5 overflow-y-auto max-h-20">
                          {dayBookings && dayBookings.length > 0 ? (
                            dayBookings.map((booking, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setBookingDetails(null)
                                  setDetailsLoading(true)
                                  fetch("/api/bookings/details", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ bookingId: booking.id }),
                                  })
                                    .then(res => res.json())
                                    .then(data => {
                                      setBookingDetails(data)
                                      setDetailsLoading(false)
                                    })
                                    .catch(err => {
                                      console.error(err)
                                      setDetailsLoading(false)
                                    })
                                }}
                                className="bg-primary/10 text-primary rounded px-0.5 py-0.5 line-clamp-1 hover:line-clamp-none cursor-pointer hover:bg-primary/20 transition-colors"
                                title={`${booking.serviceType} at ${booking.time}${
                                  booking.duration ? ` (${booking.duration})` : ""
                                }`}
                              >
                                <div className="font-medium truncate text-xs">
                                  {booking.serviceType}
                                </div>
                              </div>
                            ))
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8 text-muted-foreground">
                Loading bookings...
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && bookings.length === 0 && (
              <div className="text-center py-8 text-muted-foreground mt-6">
                No confirmed bookings found
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Booking Details Modal */}
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
              {detailsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading details...
                </div>
              ) : bookingDetails?.error ? (
                <div className="text-center py-8 text-red-600">
                  Error loading details
                </div>
              ) : (
                <>
                  {/* Service Details */}
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

                  {/* Client Details */}
                  {bookingDetails?.serviceRequest && (
                    <div className="space-y-4 border-t border-border/40 pt-6">
                      <h4 className="font-semibold text-foreground">Client</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Name
                          </div>
                          <div className="text-sm">
                            {bookingDetails.serviceRequest["Client Name"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Email
                          </div>
                          <div className="text-sm">
                            {bookingDetails.serviceRequest["Email"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Phone
                          </div>
                          <div className="text-sm">
                            {bookingDetails.serviceRequest["Phone Number"] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                            Pets
                          </div>
                          <div className="text-sm">
                            {bookingDetails.pets || "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Address */}
                  {bookingDetails?.address && (
                    <div className="space-y-4 border-t border-border/40 pt-6">
                      <h4 className="font-semibold text-foreground">Location</h4>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                          Address
                        </div>
                        <div className="text-sm">
                          {bookingDetails.address}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* All Booking Fields */}
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
                </>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
