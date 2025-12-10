/**
 * Generate a black and white SVG logo from company initials
 * Returns a data URL that can be used as logoUrl
 */
export function generateLogoFromInitials(name: string): string {
  // Extract initials (first 2 letters)
  const initials = name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Create SVG with black background and white text
  const svg = `
    <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" fill="#000000" rx="8"/>
      <text 
        x="32" 
        y="42" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="24" 
        font-weight="600" 
        fill="#FFFFFF" 
        text-anchor="middle" 
        dominant-baseline="central"
      >
        ${initials}
      </text>
    </svg>
  `.trim();

  // Convert to data URL
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

/**
 * Extract initials from company name
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
