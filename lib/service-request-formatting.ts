/**
 * Formatting utilities for service request data
 */

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount)
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string | undefined): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  } catch {
    return dateString
  }
}

export function getDaysPending(submittedDate: string | undefined): number | null {
  if (!submittedDate) return null
  try {
    const date = new Date(submittedDate)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  } catch {
    return null
  }
}

export function getPaymentStatus(
  depositAmount: number | undefined,
  totalPrice: number | undefined,
  status: string
): {
  text: string
  percentage: number
  isOverdue: boolean
} {
  // If explicitly marked as paid or rejected, show that
  if (status === "Full Paid") {
    return { text: "Fully Paid", percentage: 100, isOverdue: false }
  }
  if (status === "Rejected") {
    return { text: "Rejected", percentage: 0, isOverdue: false }
  }

  // Calculate payment percentage
  if (!depositAmount || !totalPrice || totalPrice === 0) {
    return { text: "No pricing", percentage: 0, isOverdue: status === "Payment Pending" }
  }

  const percentage = Math.round((depositAmount / totalPrice) * 100)
  const isOverdue = status === "Payment Pending"

  if (percentage === 0) {
    return { text: "No deposit", percentage: 0, isOverdue }
  } else if (percentage < 100) {
    return { text: `${percentage}% paid`, percentage, isOverdue }
  } else {
    return { text: "Fully paid", percentage: 100, isOverdue: false }
  }
}

export function getDaysUntilPreferred(preferredDate: string | undefined): string {
  if (!preferredDate) return "—"
  try {
    const date = new Date(preferredDate)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days ago`
    } else if (diffDays === 0) {
      return "Today"
    } else if (diffDays === 1) {
      return "Tomorrow"
    } else {
      return `In ${diffDays} days`
    }
  } catch {
    return formatDate(preferredDate)
  }
}

export function shouldHighlight(status: string): boolean {
  return ["Payment Pending", "Pending Review"].includes(status)
}

export function formatAddress(fields: Record<string, any>): string {
  const parts = [
    fields["First Line of Address"],
    fields["Town"],
    fields["City / County"],
    fields["Postcode"],
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(", ") : "—"
}
