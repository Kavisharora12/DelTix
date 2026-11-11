"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useGlobalShortcuts() {
  const router = useRouter();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingKeyRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if active element is an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Check for '?' key (often Shift + /)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      const key = e.key.toLowerCase();

      // Sequential 'g' prefix navigation: g r, g a, g s, g p, g l, g u
      if (pendingKeyRef.current === "g") {
        if (timerRef.current) clearTimeout(timerRef.current);
        pendingKeyRef.current = null;

        if (key === "r") {
          e.preventDefault();
          router.push("/runs");
        } else if (key === "a") {
          e.preventDefault();
          router.push("/approvals");
        } else if (key === "s") {
          e.preventDefault();
          router.push("/agents");
        } else if (key === "p") {
          e.preventDefault();
          router.push("/policies");
        } else if (key === "l") {
          e.preventDefault();
          router.push("/ledger");
        } else if (key === "u") {
          e.preventDefault();
          router.push("/audit");
        }
        return;
      }

      if (key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        pendingKeyRef.current = "g";
        if (timerRef.current) clearTimeout(timerRef.current);
        // Clear pending key after 1 second if no follow-up key
        timerRef.current = setTimeout(() => {
          pendingKeyRef.current = null;
        }, 1000);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return {
    shortcutsOpen,
    setShortcutsOpen,
  };
}

