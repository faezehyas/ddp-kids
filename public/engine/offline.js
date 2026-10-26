// Offline: registers /sw.js, which keeps the whole site on this device once
// it has been opened. Every page calls workOffline() once. Without service
// workers (or when the browser refuses one) the site just needs the network.
export function workOffline() {
  navigator.serviceWorker?.register("/sw.js").catch(() => {});
}
