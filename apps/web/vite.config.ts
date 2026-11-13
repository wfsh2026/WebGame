import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import metadata from './package.json';

const reactPlugin = react();
const releaseId = process.env.RELEASE_ID ?? 'local';
const buildTime = new Date();
const builtAt = buildTime.toISOString();
const versionInfo = { version: metadata.version, release: releaseId, builtAt };
const versionSource = JSON.stringify(versionInfo, null, 2);
const apiTarget = process.env.DEV_API_TARGET ?? 'http://127.0.0.1:3101';
const roomTarget = process.env.DEV_ROOM_TARGET ?? 'ws://127.0.0.1:3102';
const versionPlugin: Plugin = { name: 'release-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: versionSource }); } };
const config = defineConfig({ plugins: [reactPlugin, versionPlugin], build: { rollupOptions: { input: { demo: 'index.html', online: 'online.html', characterCreator: 'character-creator.html' } } }, server: { port: 5173, strictPort: true, proxy: { '/api': apiTarget, '/room': { target: roomTarget, ws: true, rewrite: path => path.replace(/^\/room/, '') } } } });

export default config;
