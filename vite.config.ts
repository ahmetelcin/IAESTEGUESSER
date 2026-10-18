import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // `npm run build:stand`: one self-contained HTML that runs by double-click (file://).
  const stand = mode === 'stand';
  return {
    // Relative asset paths so nothing resolves against the filesystem root.
    base: './',
    plugins: stand ? [viteSingleFile()] : [],
    build: {
      outDir: stand ? 'dist-stand' : 'dist',
      // mapillary-js alone is ~1 MB.
      chunkSizeWarningLimit: 1500,
    },
    test: {
      environment: 'node',
    },
  };
});
