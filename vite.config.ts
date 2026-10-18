import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // mapillary-js alone is ~1 MB; the stand build is a single file anyway.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
  },
});
