"use client"

import { useMemo, useState } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/search-input"
import { SelectDropdown } from "@/components/select-dropdown"
import { useListControls, type SortOption } from "@/hooks/useListControls"
import {
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "@remixicon/react"

interface AirtableRecord {
  id: string
  fields: Record<string, any>
}

interface ClientRow {
  client: AirtableRecord
  clientName: string
  email: string
  phone: string
  petNames: string
  nextBookingLabel: string
  nextBookingSortKey: number
  linkedPets: AirtableRecord[]
}

export default function ClientsPage() {
  const { data: clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useAirtableData(
    process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID || ""
  )
  const { data: pets, loading: petsLoading, error: petsError, refetch: refetchPets } = useAirtableData(
    process.env.NEXT_PUBLIC_PETS_TABLE_ID || ""
  )
  const { data: bookings, loading: bookingsLoading, error: bookingsError, refetch: refetchBookings } = useAirtableData(
    process.env.NEXT_PUBLIC_CONFIRMED_BOOKINGS_TABLE_ID || ""
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (clientId: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(clientId)) {
      newSet.delete(clientId)
    } else {
      newSet.add(clientId)
    }
    setExpandedIds(newSet)
  }

  const getPetNamesForClient = (clientId: string): string => {
    return pets
      .filter(
        (pet) =>
          pet.fields["Client"] &&
          (Array.isArray(pet.fields["Client"])
            ? pet.fields["Client"].includes(clientId)
            : pet.fields["Client"] === clientId)
      )
      .map((pet) => pet.fields["Pet Name"] || "Unnamed")
      .join(", ")
  }

  const getLinkedPetsForClient = (clientId: string): AirtableRecord[] => {
    return pets.filter(
      (pet) =>
        pet.fields["Client"] &&
        (Array.isArray(pet.fields["Client"])
          ? pet.fields["Client"].includes(clientId)
          : pet.fields["Client"] === clientId)
    )
  }

  const getNextBookingForClient = (clientId: string, clientName: string): { label: string; sortKey: number } => {
    const futureBookings = bookings
      .filter((booking) => {
        const bookingClient = booking.fields["Client Name"] || booking.fields["Client"]
        const matches =
          bookingClient === clientName ||
          (Array.isArray(bookingClient) && bookingClient.includes(clientId))
        return matches
      })
      .filter((booking) => {
        const date = booking.fields["Date"] || booking.fields["Booking Date"]
        if (!date) return false
        const bookingDate = new Date(date)
        return bookingDate > new Date()
      })
      .sort((a, b) => {
        const dateA = new Date(a.fields["Date"] || a.fields["Booking Date"] || "")
        const dateB = new Date(b.fields["Date"] || b.fields["Booking Date"] || "")
        return dateA.getTime() - dateB.getTime()
      })

    if (futureBookings.length > 0) {
      const date = futureBookings[0].fields["Date"] || futureBookings[0].fields["Booking Date"]
      const bookingDate = new Date(date)
      return { label: bookingDate.toLocaleDateString(), sortKey: bookingDate.getTime() }
    }
    return { label: "No upcoming bookings", sortKey: Infinity }
  }

  const refetchAll = () => {
    refetchClients()
    refetchPets()
    refetchBookings()
  }

  const loading = clientsLoading || petsLoading || bookingsLoading
  const error = clientsError || petsError || bookingsError

  const rows: ClientRow[] = useMemo(
    () =>
      clients.map((client) => {
        const clientName = client.fields["Full Name"] || "Unknown"
        const nextBooking = getNextBookingForClient(client.id, clientName)
        return {
          client,
          clientName,
          email: client.fields["Email"] || "",
          phone: client.fields["Phone Number"] || "",
          petNames: getPetNamesForClient(client.id),
          nextBookingLabel: nextBooking.label,
          nextBookingSortKey: nextBooking.sortKey,
          linkedPets: getLinkedPetsForClient(client.id),
        }
      }),
    [clients, pets, bookings]
  )

  const sortOptions: SortOption<ClientRow>[] = [
    { value: "name-asc", label: "Name (A–Z)", compare: (a, b) => a.clientName.localeCompare(b.clientName) },
    { value: "name-desc", label: "Name (Z–A)", compare: (a, b) => b.clientName.localeCompare(a.clientName) },
    { value: "booking-asc", label: "Next Booking (Soonest)", compare: (a, b) => a.nextBookingSortKey - b.nextBookingSortKey },
  ]

  const { search, setSearch, sortValue, setSortValue, filteredData } = useListControls({
    data: rows,
    getSearchableValues: (r) => [r.clientName, r.email, r.phone, r.petNames, r.nextBookingLabel],
    sortOptions,
    defaultSortValue: "name-asc",
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight pl-8">Clients</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold pl-8">Clients</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
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
              Loading clients...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              <p className="font-medium">Error loading data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && clients.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No clients found
            </div>
          )}

          {!loading && !error && clients.length > 0 && (
            <div className="space-y-2">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-2 mb-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search clients..."
                  className="sm:max-w-xs"
                />
                <SelectDropdown
                  value={sortValue}
                  onValueChange={setSortValue}
                  options={sortOptions.map(({ value, label }) => ({ value, label }))}
                  placeholder="Sort by"
                />
              </div>

              {/* Header Row */}
              <div className="sticky top-16 bg-background/95 backdrop-blur-sm border-b border-border/40 p-4 flex items-center gap-4 z-10">
                <div className="flex-1 grid grid-cols-5 gap-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Name</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Email</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Phone</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Pets</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Next Booking</div>
                </div>
                <div className="flex-shrink-0 w-5" />
              </div>

              {filteredData.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No clients match your search
                </div>
              )}

              {filteredData.map((row) => {
                const client = row.client
                const isExpanded = expandedIds.has(client.id)

                // Fields to hide from expanded detail (already shown in summary)
                const summaryFields = [
                  "Full Name",
                  "Email",
                  "Phone Number",
                ]

                return (
                  <div key={client.id} className="border border-border/40 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <button
                      onClick={() => toggleExpanded(client.id)}
                      className="w-full bg-card hover:bg-secondary/50 transition-colors p-4 flex items-center gap-4 text-left"
                    >
                      <div className="flex-1 grid grid-cols-5 gap-4">
                        <div className="text-sm font-medium">{row.clientName}</div>
                        <div className="text-sm truncate">{row.email || "—"}</div>
                        <div className="text-sm">{row.phone || "—"}</div>
                        <div className="text-sm truncate">{row.petNames || "—"}</div>
                        <div className="text-sm">{row.nextBookingLabel}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <RiArrowUpSLine className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <RiArrowDownSLine className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-border/40 bg-secondary/20 p-4 space-y-6">
                        {/* Client Fields */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Client Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(client.fields)
                              .filter(([key]) => !summaryFields.includes(key))
                              .map(([key, value]) => (
                                <div key={key}>
                                  <div className="text-xs font-semibold text-muted-foreground uppercase">
                                    {key}
                                  </div>
                                  <div className="text-sm text-foreground break-words">
                                    {typeof value === "object"
                                      ? JSON.stringify(value)
                                      : String(value || "—")}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Linked Pets */}
                        {row.linkedPets.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-3">Pets ({row.linkedPets.length})</h3>
                            <div className="space-y-3">
                              {row.linkedPets.map((pet) => (
                                <Card key={pet.id} className="p-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(pet.fields).map(([key, value]) => (
                                      <div key={key}>
                                        <div className="text-xs font-semibold text-muted-foreground uppercase">
                                          {key}
                                        </div>
                                        <div className="text-sm text-foreground break-words">
                                          {typeof value === "object"
                                            ? JSON.stringify(value)
                                            : String(value || "—")}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )}
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
