import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// base './' so the build works from a GitHub Pages sub-path.
// assets/ is served as the site root: assets/bg/bg_hub.png -> ./bg/bg_hub.png
// `npm run dev` serves over HTTPS on the LAN so a Quest on the same Wi-Fi can open it.
// `npm run dev:usb` serves plain HTTP; with `adb reverse` the Quest opens it as
// http://localhost:5173, which is a secure context, so WebXR works without a cert.
export default defineConfig({
  base: './',
  publicDir: 'assets',
  plugins: process.env.USB ? [] : [basicSsl()],
  server: { host: true },
});
