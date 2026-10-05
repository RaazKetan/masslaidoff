import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

function removeEmDashes() {
  return {
    name: 'remove-em-dashes',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') {
          output.code = output.code.replaceAll('\u2014', ' - ');
        } else if (typeof output.source === 'string') {
          output.source = output.source.replaceAll('\u2014', ' - ');
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), removeEmDashes()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['gsap', 'motion'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
