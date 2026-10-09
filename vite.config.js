import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// base './' so the build works from a GitHub Pages sub-path.
// assets/ is served as the site root: assets/bg/bg_hub.png -> ./bg/bg_hub.png
// `npm run dev` serves over HTTPS on the LAN so a Quest on the same Wi-Fi can open it.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  plugins: [basicSsl()],
  server: { host: true },
});
