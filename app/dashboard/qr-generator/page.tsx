"use client"

import { useRef, useState } from "react"
import { FloatingSidebar } from "@/components/floating-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import QRCode from "react-qr-code"
import { RiDownloadLine } from "@remixicon/react"
import { downloadQRCode } from "@/lib/qr-utils"

export default function QRGeneratorPage() {
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  const isValidUrl = (urlString: string): boolean => {
    if (!urlString) return false
    try {
      const urlObj = new URL(urlString)
      return urlObj.protocol === "http:" || urlObj.protocol === "https:"
    } catch {
      return false
    }
  }

  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (value && !isValidUrl(value)) {
      setError("Please enter a valid URL starting with http:// or https://")
    } else {
      setError("")
    }
  }

  const showQR = url && !error && isValidUrl(url)

  const handleDownload = async () => {
    if (!containerRef.current) return

    try {
      const svgElement = containerRef.current.querySelector("svg")
      if (!svgElement) {
        throw new Error("QR code SVG not found")
      }

      const timestamp = Date.now()
      const filename = `qr-code-${timestamp}.png`
      downloadQRCode(svgElement, filename)
    } catch (err) {
      console.error("Failed to download QR code:", err)
      setError("Failed to download QR code. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/40 backdrop-blur-md bg-background/95">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8 pl-28 sm:pl-6">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold tracking-tight">QR Generator</h1>
              <p className="text-sm text-muted-foreground">
                Generate QR codes from any URL
              </p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold">QR Generator</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Floating Sidebar */}
      <FloatingSidebar />

      {/* Main Content */}
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Generator</CardTitle>
              <CardDescription>
                Enter a URL and download it as a QR code image
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* URL Input Section */}
              <Field>
                <FieldLabel>
                  <span className="font-medium">URL</span>
                  <FieldDescription>
                    Enter the URL you want to encode
                  </FieldDescription>
                </FieldLabel>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="mt-2"
                />
                {error && <FieldError>{error}</FieldError>}
              </Field>

              {/* QR Code Display Section */}
              {showQR && (
                <div className="space-y-4">
                  <div
                    ref={containerRef}
                    className="flex flex-col items-center justify-center p-8 bg-background border border-border rounded-lg"
                  >
                    <QRCode
                      value={url}
                      size={256}
                      level="M"
                      fgColor="hsl(var(--foreground))"
                      bgColor="hsl(var(--background))"
                    />
                  </div>

                  {/* Download Button */}
                  <Button
                    onClick={handleDownload}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <RiDownloadLine className="w-4 h-4" />
                    Download QR Code (PNG)
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {!showQR && !error && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Enter a valid URL to generate a QR code
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
