# Apple WebRTC platform adapter

This Capacitor plugin supplies the direct-sync WebRTC DataChannel on Apple
runtimes whose WKWebView does not expose `RTCPeerConnection`, notably the iPad
app running on Apple-silicon Macs.

- It is an Apple-only transport adapter. Rendezvous, encryption, sync, and
  conflict rules remain in the shared packages.
- It accepts STUN URLs only and does not enable TURN or media tracks.
- The native WebRTC XCFramework is pinned in `Package.swift`; Xcode records the
  resolved revision in the application's `Package.resolved` file.
