import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveBuildIdentity, yavnBuildIdentity } from './scripts/build-identity.mjs';
import { yavnPwa } from './scripts/pwa.mjs';

const identity = resolveBuildIdentity();

export default defineConfig({
  plugins: [react(), yavnBuildIdentity(identity), yavnPwa({ identity })],
});
