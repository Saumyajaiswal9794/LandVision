import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Co-locate tests next to source under __tests__/
    include: ['src/**/__tests__/**/*.test.ts'],
    // Run tests in the Node environment (we touch Buffer / Tesseract / mongoose).
    environment: 'node',
    // Don't bail the whole suite on a single failure — surface every error
    // at once so the developer can fix them in one pass.
    bail: 0,
    globals: false,
  },
});
