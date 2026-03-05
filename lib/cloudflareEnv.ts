/**
 * Access Cloudflare Pages env / bindings in edge API routes.
 * Use (getRequestContext().env as Record<string, string>) for secret vars — only call inside handlers.
 */
import { getRequestContext } from "@cloudflare/next-on-pages";

export function getEnv(): Record<string, string> {
  try {
    return (getRequestContext().env as Record<string, string>) ?? {};
  } catch {
    return typeof process !== "undefined" && process.env ? (process.env as Record<string, string>) : {};
  }
}
