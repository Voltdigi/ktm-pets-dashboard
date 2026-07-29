export const STATUS_OPTIONS = [
  "Pending Review",
  "Payment Pending",
  "Deposit Paid",
  "Full Paid",
  "Rejected",
] as const

export type ServiceRequestStatus = (typeof STATUS_OPTIONS)[number]

export const DEFAULT_STATUS: ServiceRequestStatus = "Pending Review"

interface StatusStyle {
  badge: string
  dot: string
  bar: string
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  "Pending Review": {
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    dot: "bg-yellow-500",
    bar: "bg-yellow-500",
  },
  "Payment Pending": {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    dot: "bg-blue-500",
    bar: "bg-blue-500",
  },
  "Deposit Paid": {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    dot: "bg-purple-500",
    bar: "bg-purple-500",
  },
  "Full Paid": {
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dot: "bg-green-500",
    bar: "bg-green-500",
  },
  Rejected: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
}

const FALLBACK_STYLE: StatusStyle = {
  badge: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  dot: "bg-gray-400",
  bar: "bg-gray-400",
}

export function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] || FALLBACK_STYLE
}

export function getStatusColor(status: string): string {
  return getStatusStyle(status).badge
}
