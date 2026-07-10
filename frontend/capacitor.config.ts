import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native store-wrap configuration (Phase 6 / P6M2 feasibility spike, ADR-029
 * Q1). Wraps the built web app (`dist/`) in a native WebView shell — the same
 * codebase ships to web/PWA and the app stores.
 *
 * The appId is provisional until first store upload (it becomes permanent
 * then — an owner decision at P6M9).
 */
const config: CapacitorConfig = {
  appId: 'com.aakashtir.signapp',
  appName: 'Sign App',
  webDir: 'dist',
}

export default config
