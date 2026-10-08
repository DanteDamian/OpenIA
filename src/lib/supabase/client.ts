"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
export function createSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config)
    throw new Error(
      "Configura las variables públicas de Supabase antes de habilitar funciones autenticadas.",
    );
  return createBrowserClient(config.url, config.key);
}
