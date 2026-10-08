import { defineConfig, devices } from '@playwright/test';

// E2E mobile — le bug ciblé se manifeste sur les petits écrans : projets 375 + 320.
// Mode par défaut : serveur dev (loop local). E2E_PREVIEW=1 : test du build de prod
// via `vite preview` (utilisé par le job e2e du Pipeline pour valider dist/).
const PREVIEW = !!process.env.E2E_PREVIEW;
const BASE_URL = PREVIEW ? 'http://localhost:4173/' : 'http://localhost:5173/';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'mobile-se', use: { ...devices['iPhone SE'] } },
    { name: 'mobile-375', use: { viewport: { width: 375, height: 667 } } },
  ],
  webServer: PREVIEW
    ? {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: BASE_URL,
        // Sync activée (même origine) pour le parcours « Signaler un bug » ; les appels
        // réseau qui échouent sont sans effet (la sync est tolérante aux erreurs).
        env: { VITE_SYNC_URL: BASE_URL.replace(/\/$/, '') },
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
});

