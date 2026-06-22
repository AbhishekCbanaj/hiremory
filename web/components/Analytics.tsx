"use client";
// Product analytics (PostHog), env-gated on NEXT_PUBLIC_POSTHOG_KEY. Renders
// nothing and does nothing until a key is present. Captures a pageview on each
// route change. Use `track()` from lib/analytics for custom events.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!KEY) return;
    if (!(posthog as unknown as { __loaded?: boolean }).__loaded) {
      posthog.init(KEY, { api_host: HOST, capture_pageview: false, capture_pageleave: true });
    }
  }, []);

  useEffect(() => {
    if (!KEY) return;
    posthog.capture("$pageview");
  }, [pathname]);

  return null;
}
