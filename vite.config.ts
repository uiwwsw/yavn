import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { yavnBuildIdentity } from './scripts/build-identity.mjs';

export default defineConfig({
  plugins: [react(), yavnBuildIdentity()],
});
