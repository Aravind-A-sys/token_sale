import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxy = {
  "/rpc": {
    target: "http://127.0.0.1:8545",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/rpc/, "/"),
  },
};

export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".e2b.app", "localhost"],
    proxy,
    fs: { deny: [".env", ".env.*", "**/.git/**", "**/legacy/**"] },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: [".e2b.app", "localhost"],
    proxy,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "ethereum",
              test: /node_modules\/(ethers|@noble|@adraffy|aes-js)\//,
              priority: 20,
            },
            { name: "react", test: /node_modules\/(react|react-dom|scheduler)\//, priority: 10 },
          ],
        },
      },
    },
  },
});
