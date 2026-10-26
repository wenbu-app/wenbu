import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: {
      'cloudflare:workers': new URL('./tests/cloudflare-stub.ts', import.meta.url).pathname,
      'cloudflare:workflows': new URL('./tests/cloudflare-workflows-stub.ts', import.meta.url).pathname,
    },
  },
});
