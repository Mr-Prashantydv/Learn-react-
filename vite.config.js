import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reactoria ships the *development* build of React on purpose:
//  - the in-game sandbox uses React's `act()` to run quests deterministically,
//    and `act` only exists in development builds;
//  - learners get React's helpful development warnings (missing keys, hook
//    rules, ...) streamed straight into the in-game console.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
