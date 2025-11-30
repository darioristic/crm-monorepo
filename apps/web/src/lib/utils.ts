import { Metadata } from "next";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateAvatarFallback(string: string) {
  const names = string.split(" ").filter((name: string) => name);
  const mapped = names.map((name: string) => name.charAt(0).toUpperCase());
  return mapped.join("");
}

export function generateMeta({
  title,
  description,
  canonical
}: {
  title: string;
  description: string;
  canonical: string;
}): Metadata {
  return {
    title: `${title} - CRM Dashboard`,
    description: description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    alternates: {
      canonical: canonical
    },
    openGraph: {
      images: [`/images/seo.jpg`]
    }
  };
}

export const getInitials = (fullName: string) => {
  const nameParts = fullName.split(" ");
  const firstNameInitial = nameParts[0]?.charAt(0).toUpperCase() || "";
  const lastNameInitial = nameParts[1]?.charAt(0).toUpperCase() || "";
  return `${firstNameInitial}${lastNameInitial}`;
};

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("sr-RS", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("sr-RS", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export function getErrorMessage(error: unknown, fallback = "An error occurred"): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
