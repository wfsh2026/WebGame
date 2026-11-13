import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootUrl = new URL('../../development/web', import.meta.url);
const root = fileURLToPath(rootUrl);
const workspaceUrl = new URL('../..', import.meta.url);
const workspace = fileURLToPath(workspaceUrl);
const dependencyNames = ['react', 'react-dom', 'phaser', '@web-game-world/contracts', '@web-game-world/simulation', 'colyseus.js', 'zod'];
const alias = dependencyNames.map(name => { const url = new URL(`./node_modules/${name}`, import.meta.url); const replacement = fileURLToPath(url); return { find: name, replacement }; });
const plugin = react();
// 仅本机开发入口；独立于正式构建，不指向玩家服务。
const config = defineConfig({ root, plugins: [plugin], resolve: { alias, dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 5174, strictPort: true, fs: { allow: [workspace] }, proxy: { '/api': 'http://127.0.0.1:3101', '/room': { target: 'ws://127.0.0.1:3102', ws: true, rewrite: path => path.replace(/^\/room/, '') } } } });
export default config;
