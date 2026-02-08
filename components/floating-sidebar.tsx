"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  RiMenuLine,
  RiCloseLine,
  RiDashboardLine,
  RiQrCodeLine,
  RiLogoutBoxLine,
} from "@remixicon/react"

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: <RiDashboardLine className="w-5 h-5" />,
    href: "/dashboard",
  },
  {
    label: "QR Generator",
    icon: <RiQrCodeLine className="w-5 h-5" />,
    href: "/dashboard/qr-generator",
  },
]

export function FloatingSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Floating Sidebar */}
      <div
        className={cn(
          "fixed left-4 top-20 h-[calc(100vh-6rem)] w-64 rounded-2xl bg-card border border-border shadow-lg z-40 transition-all duration-300 ease-out",
          isOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-full opacity-0 pointer-events-none"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Menu</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <RiCloseLine className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:text-foreground hover:bg-secondary/50"
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-1 bg-primary rounded-r-full" />
                )}

                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-border" />

        {/* Logout Button */}
        <div className="p-4">
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/5"
          >
            <RiLogoutBoxLine className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed left-4 top-4 z-40 h-10 w-10 rounded-full shadow-md transition-all duration-300",
          isOpen
            ? "bg-secondary hover:bg-secondary/80"
            : "bg-card hover:bg-secondary border border-border"
        )}
      >
        <RiMenuLine className="w-5 h-5" />
      </Button>
    </>
  )
}
