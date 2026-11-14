import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

/** True inside the Android (later iOS) app built with Capacitor; false in a browser. See docs/09-android-app.md. */
export const isNativeApp = Capacitor.isNativePlatform();

const PHONE_QUERY = "(max-width: 767px)";

/** Phone layout (docs/10-mobile-ui.md): the Android app and any browser narrower than 768 px. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
