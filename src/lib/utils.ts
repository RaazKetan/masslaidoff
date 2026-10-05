import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mirrors validLinkedInURL in backend/internal/httpapi/server.go.
export function isLinkedInProfileURL(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname.replace(/^www\./, "") === "linkedin.com" &&
      url.pathname.startsWith("/in/") &&
      url.pathname.length > "/in/x".length
    );
  } catch {
    return false;
  }
}
