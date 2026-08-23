"use client"

import { useState } from "react"
import { RiCheckLine, RiCloseLine, RiLoader4Line, RiMailLine, RiMapPinLine, RiTimeLine } from "@remixicon/react"
import { STATUS_OPTIONS, DEFAULT_STATUS, getStatusColor } from "@/lib/service-request-status"
import {
  formatCurrency,
  formatDate,
  getDaysPending,
  formatAddress,
} from "@/lib/service-request-formatting"

interface ServiceRequestCardProps {
  record: {
    id: string
    fields: Record<string, any>
  }
  onStatusUpdate?: (recordId: string, newStatus: string) => Promise<void>
  bookings?: Array<{
    id: string
    fields: Record<string, any>
  }>
  petNames?: string
}

// Helper function to format DD/MM/YYYY dates to readable format
function formatDDMMYYYY(dateString: string): string {
  if (!dateString) return "—"
  try {
    const [day, month, year] = dateString.split("/").map(Number)
    const dateObj = new Date(year, month - 1, day)
    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateString
  }
}

export function ServiceRequestCard({ record, onStatusUpdate, bookings = [], petNames }: ServiceRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const fields = record.fields
  const currentStatus = fields["Status"] || DEFAULT_STATUS

  // Parse preferred dates from "Preferred Date and Time" field
  const preferredDatesRaw = fields["Preferred Date and Time"] || ""

  // Extract dates from the preferred dates field
  // Handles format like "04/09/2026 | Exact Time: 10:00"
  const preferredDates = preferredDatesRaw
    ? preferredDatesRaw
        .split(/[,\n]/) // Split by comma or newline
        .map((item: string) => {
          // Remove quotes and clean up
          item = item.trim().replace(/^["']|["']$/g, "")
          // Extract just the date part (DD/MM/YYYY) before the pipe
          const dateMatch = item.match(/(\d{2}\/\d{2}\/\d{4})/)
          return dateMatch ? dateMatch[1] : null
        })
        .filter((date: string | null): date is string => date !== null && date !== "")
        .filter((date: string, index: number, arr: string[]) => {
          // Remove duplicates
          return arr.indexOf(date) === index
        })
        .sort((a: string, b: string) => {
          // Sort by date (DD/MM/YYYY format)
          const [dA, mA, yA] = a.split("/").map(Number)
          const [dB, mB, yB] = b.split("/").map(Number)
          const dateA = new Date(yA, mA - 1, dA)
          const dateB = new Date(yB, mB - 1, dB)
          return dateA.getTime() - dateB.getTime()
        })
    : []

  const firstBookingDate = preferredDates.length > 0 ? preferredDates[0] : null
  const lastBookingDate = preferredDates.length > 1 ? preferredDates[preferredDates.length - 1] : null

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus || !onStatusUpdate) return

    setIsLoading(true)
    setMessage(null)
    setIsOpen(false)

    try {
      await onStatusUpdate(record.id, newStatus)

      setMessage({
        type: "success",
        text: `Status updated to "${newStatus}"${newStatus === "Payment Pending" ? " - Invoices created!" : ""}`,
      })

      setTimeout(() => {
        setMessage(null)
      }, 5000)
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Failed to update status"
      setMessage({
        type: "error",
        text: errorText,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const daysPending = getDaysPending(fields["Submitted Date"])

  return (
    <div className="space-y-4">
      {/* Status Update Message */}
      {message && (
        <div
          className={`p-3 rounded-md flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <RiCheckLine className="w-4 h-4 flex-shrink-0" />
          ) : (
            <RiCloseLine className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Client Information Section */}
      <div className="border-b border-border/40 pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide opacity-70">
          Client Information
        </h3>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-foreground/60">Name</p>
              <p className="text-sm font-medium text-foreground">{fields["Client Name"] || "—"}</p>
            </div>
          </div>

          {fields["Email"] && (
            <div className="flex items-center gap-2 text-sm">
              <RiMailLine className="w-4 h-4 text-foreground/50" />
              <a
                href={`mailto:${fields["Email"]}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {fields["Email"]}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Service Details Section */}
      <div className="border-b border-border/40 pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide opacity-70">
          Service Details
        </h3>
        <div className="space-y-3">
          {fields["Service Type"] && (
            <div>
              <p className="text-xs font-medium text-foreground/60">Service Type</p>
              <p className="text-sm font-medium text-foreground">{fields["Service Type"]}</p>
            </div>
          )}

          {fields["Description"] && (
            <div>
              <p className="text-xs font-medium text-foreground/60">Description</p>
              <p className="text-sm text-foreground">{fields["Description"]}</p>
            </div>
          )}

          {petNames && (
            <div>
              <p className="text-xs font-medium text-foreground/60">Pet Names</p>
              <p className="text-sm font-medium text-foreground">{petNames}</p>
            </div>
          )}

          {firstBookingDate && (
            <div>
              <p className="text-xs font-medium text-foreground/60">First Booking Date</p>
              <p className="text-sm font-medium text-foreground">{formatDDMMYYYY(firstBookingDate)}</p>
            </div>
          )}

          {lastBookingDate && (
            <div>
              <p className="text-xs font-medium text-foreground/60">Last Booking Date</p>
              <p className="text-sm font-medium text-foreground">{formatDDMMYYYY(lastBookingDate)}</p>
            </div>
          )}

          {preferredDates.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground/60 mb-2">All Requested Dates ({preferredDates.length})</p>
              <div className="flex flex-wrap gap-2">
                {preferredDates.map((date, index) => (
                  <div
                    key={`${date}-${index}`}
                    className="px-3 py-2 rounded-md bg-primary/10 border border-primary/20"
                  >
                    <p className="text-sm font-medium text-foreground">{formatDDMMYYYY(date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 text-sm">
            <RiMapPinLine className="w-4 h-4 text-foreground/50 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground/60 mb-1">Service Address</p>
              <p className="text-sm text-foreground">
                {formatAddress(fields)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary Section */}
      <div className="border-b border-border/40 pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide opacity-70">
          Financial Summary
        </h3>
        <div className="space-y-2">
          {fields["Total Price"] !== undefined && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground/70">Total Price</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(fields["Total Price"])}
              </p>
            </div>
          )}

          {fields["Deposit Amount"] !== undefined && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground/70">Deposit</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(fields["Deposit Amount"])}
              </p>
            </div>
          )}

          {fields["Total Price"] !== undefined && fields["Deposit Amount"] !== undefined && (
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <p className="text-sm text-foreground/70">Balance Due</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(fields["Total Price"] - fields["Deposit Amount"])}
              </p>
            </div>
          )}

          {fields["Price Per Unit"] !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <p className="text-foreground/60">Price Per Unit</p>
              <p className="text-foreground/80">{formatCurrency(fields["Price Per Unit"])}</p>
            </div>
          )}

          {fields["Add-On Price"] !== undefined && (
            <div className="flex items-center justify-between text-xs">
              <p className="text-foreground/60">Add-On Price</p>
              <p className="text-foreground/80">{formatCurrency(fields["Add-On Price"])}</p>
            </div>
          )}
        </div>
      </div>

      {/* Request Status Section */}
      <div className="pb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide opacity-70">
          Request Status
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-foreground/60 mb-2">Current Status</p>
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isLoading}
                className={`w-full px-3 py-2 text-sm border border-border/40 rounded-md bg-background hover:bg-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 ${getStatusColor(currentStatus)}`}
              >
                <span className="text-foreground font-medium">{currentStatus}</span>
                {isLoading ? (
                  <RiLoader4Line className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-xs">▼</span>
                )}
              </button>

              {/* Dropdown Menu */}
              {isOpen && !isLoading && (
                <div className="absolute top-full mt-1 w-full bg-background border border-border/40 rounded-md shadow-md z-10">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors ${
                        status === currentStatus
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground"
                      } ${status === STATUS_OPTIONS[0] ? "rounded-t-md" : ""} ${
                        status === STATUS_OPTIONS[STATUS_OPTIONS.length - 1] ? "rounded-b-md" : ""
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {fields["Submitted Date"] && (
            <div className="flex items-center gap-2 text-xs">
              <RiTimeLine className="w-3 h-3 text-foreground/50" />
              <span className="text-foreground/70">
                Submitted {formatDate(fields["Submitted Date"])}
                {daysPending !== null && <span> ({daysPending} days ago)</span>}
              </span>
            </div>
          )}

          {fields["Square Invoice Link"] && (
            <div className="pt-2">
              <a
                href={fields["Square Invoice Link"]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View Invoice →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
