export function getWebsiteLogo(website?: string | null) {
  if (!website) return "";

  // Clean up the domain - remove protocol, www, paths
  const domain = website
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase()
    .trim();

  // If it doesn't look like a domain, return empty
  if (!domain || !domain.includes(".")) return "";

  return `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ&size=180&retina=true`;
}
