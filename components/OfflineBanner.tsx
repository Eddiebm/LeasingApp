"use client";

import { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const set = () => setOffline(!navigator.onLine);
    set();
    window.addEventListener("offline", set);
    window.addEventListener("online", set);
    return () => {
      window.removeEventListener("offline", set);
      window.removeEventListener("online", set);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-600 px-4 py-2 text-center text-sm font-medium text-white">
      You&apos;re offline. Some features may be unavailable until you reconnect.
    </div>
  );
}
