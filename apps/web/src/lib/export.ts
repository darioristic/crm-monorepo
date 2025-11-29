/**
 * Export utilities for reports - CSV and PDF generation
 */

export type ColumnDef<T> = {
  key: keyof T | string;
  header: string;
  format?: (value: unknown, row: T) => string;
};

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: ColumnDef<T>[]
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Build header row
  const headers = columns.map((col) => `"${col.header}"`).join(",");

  // Build data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = getNestedValue(row, col.key as string);
        const formatted = col.format ? col.format(value, row) : String(value ?? "");
        // Escape quotes and wrap in quotes
        return `"${formatted.replace(/"/g, '""')}"`;
      })
      .join(",");
  });

  const csvContent = [headers, ...rows].join("\n");
  downloadFile(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export HTML element to PDF
 * Uses html2canvas to capture the element and generates a PDF
 */
export async function exportToPDF(
  elementId: string,
  filename: string,
  options: {
    title?: string;
    dateRange?: string;
    filters?: string;
  } = {}
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return;
  }

  try {
    // Dynamically import libraries
    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    
    const html2canvas = html2canvasModule.default;
    const { jsPDF } = jsPDFModule;

    // Capture element as canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "mm",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // Add header
    let yPos = margin;
    
    if (options.title) {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(options.title, margin, yPos);
      yPos += 8;
    }

    if (options.dateRange) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Period: ${options.dateRange}`, margin, yPos);
      yPos += 5;
    }

    if (options.filters) {
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Filters: ${options.filters}`, margin, yPos);
      yPos += 5;
    }

    yPos += 5;

    // Calculate image dimensions
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image, handling multi-page if needed
    const availableHeight = pageHeight - yPos - margin;
    
    if (imgHeight <= availableHeight) {
      pdf.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
    } else {
      // Split across multiple pages
      let remainingHeight = imgHeight;
      let sourceY = 0;
      let isFirstPage = true;

      while (remainingHeight > 0) {
        if (!isFirstPage) {
          pdf.addPage();
          yPos = margin;
        }

        const sliceHeight = Math.min(
          remainingHeight,
          isFirstPage ? availableHeight : pageHeight - 2 * margin
        );
        
        const sliceRatio = sliceHeight / imgHeight;
        const sourceHeight = canvas.height * sliceRatio;

        // Create a slice of the canvas
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sourceHeight;
        
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceHeight,
            0,
            0,
            canvas.width,
            sourceHeight
          );
          
          const sliceData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", margin, yPos, imgWidth, sliceHeight);
        }

        sourceY += sourceHeight;
        remainingHeight -= sliceHeight;
        isFirstPage = false;
      }
    }

    // Add footer with generation date
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Generated on ${new Date().toLocaleString()} - Page ${i} of ${totalPages}`,
        margin,
        pageHeight - 5
      );
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF. Make sure html2canvas and jspdf are installed.");
  }
}

/**
 * Simple table data to PDF (without html2canvas)
 */
export function exportTableToPDF<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: ColumnDef<T>[],
  options: {
    title?: string;
    dateRange?: string;
  } = {}
): void {
  import("jspdf").then(({ jsPDF }) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    let yPos = margin;

    // Title
    if (options.title) {
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(options.title, margin, yPos);
      yPos += 10;
    }

    if (options.dateRange) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Period: ${options.dateRange}`, margin, yPos);
      yPos += 8;
    }

    // Table header
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    const colWidth = (pageWidth - 2 * margin) / columns.length;
    
    columns.forEach((col, i) => {
      pdf.text(col.header, margin + i * colWidth, yPos, { maxWidth: colWidth - 2 });
    });
    
    yPos += 6;
    pdf.setLineWidth(0.1);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    // Table body
    pdf.setFont("helvetica", "normal");
    
    for (const row of data) {
      if (yPos > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPos = margin;
      }

      columns.forEach((col, i) => {
        const value = getNestedValue(row, col.key as string);
        const text = col.format ? col.format(value, row) : String(value ?? "");
        pdf.text(text, margin + i * colWidth, yPos, { maxWidth: colWidth - 2 });
      });
      
      yPos += 5;
    }

    pdf.save(`${filename}.pdf`);
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current, key) => {
    return current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
  }, obj as unknown);
}

/**
 * Trigger file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Format currency value
 */
export function formatCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Format date value
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

