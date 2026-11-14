import { Capacitor } from "@capacitor/core";

/** True inside the Android (later iOS) app built with Capacitor; false in a browser. See docs/09-android-app.md. */
export const isNativeApp = Capacitor.isNativePlatform();
