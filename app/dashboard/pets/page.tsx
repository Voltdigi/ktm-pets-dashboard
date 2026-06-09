"use client"

import { useState } from "react"
import { useAirtableData } from "@/hooks/useClients"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "@remixicon/react"

interface AirtableRecord {
  id: string
  fields: Record<string, any>
}

export default function PetsPage() {
  const { data: pets, loading: petsLoading, error: petsError, refetch: refetchPets } = useAirtableData(
    process.env.NEXT_PUBLIC_PETS_TABLE_ID || ""
  )
  const { data: clients, loading: clientsLoading, error: clientsError, refetch: refetchClients } = useAirtableData(
    process.env.NEXT_PUBLIC_CLIENTS_TABLE_ID || ""
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (petId: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(petId)) {
      newSet.delete(petId)
    } else {
      newSet.add(petId)
    }
    setExpandedIds(newSet)
  }

  const getClientNameForPet = (petClientData: any): string => {
    if (!petClientData) return "—"
    if (Array.isArray(petClientData)) {
      const clientIds = petClientData
      const matchingClients = clients.filter(c => clientIds.includes(c.id))
      return matchingClients.map(c => c.fields["Full Name"] || "Unknown").join(", ") || "—"
    } else if (typeof petClientData === "string") {
      const clientId = petClientData
      const matchingClient = clients.find(c => c.id === clientId)
      return matchingClient?.fields["Full Name"] || "Unknown"
    }
    return "—"
  }

  const getLinkedClientsForPet = (petClientData: any): AirtableRecord[] => {
    if (!petClientData) return []
    if (Array.isArray(petClientData)) {
      return clients.filter(c => petClientData.includes(c.id))
    } else if (typeof petClientData === "string") {
      const client = clients.find(c => c.id === petClientData)
      return client ? [client] : []
    }
    return []
  }

  const refetchAll = () => {
    refetchPets()
    refetchClients()
  }

  const loading = petsLoading || clientsLoading
  const error = petsError || clientsError

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight pl-8">Pets</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold pl-8">Pets</h1>
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
              Loading pets...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              <p className="font-medium">Error loading data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && pets.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No pets found
            </div>
          )}

          {!loading && !error && pets.length > 0 && (
            <div className="space-y-2">
              {/* Header Row */}
              <div className="sticky top-16 bg-background/95 backdrop-blur-sm border-b border-border/40 p-4 flex items-center gap-4 z-10">
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Pet Name</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Species</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Breed</div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Owner</div>
                </div>
                <div className="flex-shrink-0 w-5" />
              </div>

              {pets.map((pet) => {
                const isExpanded = expandedIds.has(pet.id)
                const petName = pet.fields["Pet Name"] || "Unknown"
                const petSpecies = pet.fields["Species"] || ""
                const breed = pet.fields["Breed"] || ""
                const clientData = pet.fields["Client"]
                const clientName = getClientNameForPet(clientData)
                const linkedClients = getLinkedClientsForPet(clientData)

                // Fields to hide from expanded detail (already shown in summary)
                const summaryFields = [
                  "Pet Name",
                  "Species",
                  "Breed",
                  "Client",
                ]

                return (
                  <div key={pet.id} className="border border-border/40 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <button
                      onClick={() => toggleExpanded(pet.id)}
                      className="w-full bg-card hover:bg-secondary/50 transition-colors p-4 flex items-center gap-4 text-left"
                    >
                      <div className="flex-1 grid grid-cols-4 gap-4">
                        <div className="text-sm font-medium">{petName}</div>
                        <div className="text-sm">{petSpecies || "—"}</div>
                        <div className="text-sm">{breed || "—"}</div>
                        <div className="text-sm">{clientName}</div>
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
                        {/* Pet Fields */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Pet Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(pet.fields)
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

                        {/* Linked Clients */}
                        {linkedClients.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold mb-3">Owner ({linkedClients.length})</h3>
                            <div className="space-y-3">
                              {linkedClients.map((client) => (
                                <Card key={client.id} className="p-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(client.fields).map(([key, value]) => (
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
