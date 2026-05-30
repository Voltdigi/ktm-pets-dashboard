"use client"

import { useState } from "react"
import { RiCheckLine, RiCloseLine, RiLoader4Line } from "@remixicon/react"

interface ServiceRequestCardProps {
  record: {
    id: string
    fields: Record<string, any>
  }
  onStatusUpdate?: (recordId: string, newStatus: string) => Promise<void>
}

const STATUS_OPTIONS = ["Pending", "Payment Pending", "Deposit Paid", "Balance Paid", "Completed", "Rejected"]

export function ServiceRequestCard({ record, onStatusUpdate }: ServiceRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const currentStatus = record.fields["Status"] || "Pending"

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

  return (
    <div className="p-4 border border-border/40 rounded-lg hover:bg-secondary/50 transition-colors">
      {/* Status Update Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-md flex items-center gap-2 text-sm ${
            message.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <RiCheckLine className="w-4 h-4" />
          ) : (
            <RiCloseLine className="w-4 h-4" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Record Details */}
      <div className="space-y-2">
        {Object.entries(record.fields).map(([key, value]) => {
          // Special handling for Status field
          if (key === "Status") {
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="font-medium text-foreground/70 min-w-fit">{key}:</span>

                <div className="relative">
                  <button
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 text-sm border border-border/40 rounded-md bg-background hover:bg-secondary/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
                  >
                    <span className="text-foreground">{currentStatus}</span>
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
            )
          }

          // Regular field display
          return (
            <div key={key} className="text-sm">
              <span className="font-medium text-foreground/70">{key}:</span>
              <span className="ml-2 text-foreground">
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
