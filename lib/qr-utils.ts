export function downloadQRCode(svgElement: SVGElement, filename: string): void {
  try {
    // Clone the SVG to avoid modifying the DOM
    const svgClone = svgElement.cloneNode(true) as SVGElement

    // Convert SVG to string
    const svgString = new XMLSerializer().serializeToString(svgClone)

    // Create a canvas element
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Set canvas size (256x256 for standard resolution)
    canvas.width = 256
    canvas.height = 256

    // Create an image from the SVG
    const img = new Image()

    // Handle SVG with potential styling
    const blob = new Blob([svgString], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      // Draw the image to the canvas
      ctx.drawImage(img, 0, 0, 256, 256)

      // Convert canvas to blob and download
      canvas.toBlob((canvasBlob) => {
        if (!canvasBlob) {
          throw new Error("Could not create blob from canvas")
        }

        const downloadUrl = URL.createObjectURL(canvasBlob)
        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Cleanup
        URL.revokeObjectURL(downloadUrl)
        URL.revokeObjectURL(url)
      }, "image/png")
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      throw new Error("Could not load SVG as image")
    }

    img.src = url
  } catch (error) {
    console.error("Error downloading QR code:", error)
    throw error
  }
}
