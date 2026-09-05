"use client"

import { Button } from "@/components/ui/button"
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react"

interface BookingDisplay {
  id: string
  date: string
  serviceType: string
  time: string
  duration: string
  petNames: string
  fields: Record<string, any>
}

interface CalendarGridProps {
  currentDate: Date
  onDateChange: (date: Date) => void
  bookingsByDate: Map<string, BookingDisplay[]>
  onSelectBooking: (booking: BookingDisplay) => void
}

const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

const getFirstDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

const formatDate = (year: number, month: number, day: number) => {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function CalendarGrid({
  currentDate,
  onDateChange,
  bookingsByDate,
  onSelectBooking,
}: CalendarGridProps) {
  const previousMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    onDateChange(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = []
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  for (let i = 0; i < firstDay; i++) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="space-y-4">
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
                            onSelectBooking(booking)
                          }}
                          className="bg-primary/10 text-primary rounded px-0.5 py-0.5 line-clamp-1 hover:line-clamp-none cursor-pointer hover:bg-primary/20 transition-colors"
                          title={`${booking.petNames} - ${booking.serviceType} at ${booking.time}${
                            booking.duration ? ` (${booking.duration})` : ""
                          }`}
                        >
                          <div className="font-medium truncate text-xs">
                            {booking.petNames}
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
    </div>
  )
}
