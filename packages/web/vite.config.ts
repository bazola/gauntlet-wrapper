import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = 'http://127.0.0.1:4577';

// 4578, not the vite default 5173 -- target repos are frequently vite
// projects themselves (gauntlet-zelda's own dev server is 5173, preview is
// 4173) and would collide if the wrapper used common defaults. strictPort
// so a collision fails loudly instead of silently drifting to a random port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4578,
    strictPort: true,
    proxy: {
      '/api': BACKEND,
      '/ws': { target: BACKEND, ws: true },
    },
  },
});
