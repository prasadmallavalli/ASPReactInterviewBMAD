/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Must match the API's Cors:FrontendOrigin (http://localhost:5173,
    // src/Api/Program.cs) -- do not change one without the other.
    port: 5173,
  },
  test: {
    environment: 'jsdom',
  },
})
