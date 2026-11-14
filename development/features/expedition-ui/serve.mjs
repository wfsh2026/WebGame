import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageUrl = new URL('../../../apps/web/package.json', import.meta.url);
const webRequire = createRequire(packageUrl);
const vitePath = webRequire.resolve('vite');
const reactPluginPath = webRequire.resolve('@vitejs/plugin-react');
const viteUrl = pathToFileURL(vitePath);
const reactPluginUrl = pathToFileURL(reactPluginPath);
const { createServer } = await import(viteUrl.href);
const { default: react } = await import(reactPluginUrl.href);
const rootUrl = new URL('../../web/', import.meta.url);
const root = fileURLToPath(rootUrl);
const workspaceUrl = new URL('../../../', import.meta.url);
const workspace = fileURLToPath(workspaceUrl);
const modules = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client'];
const alias = modules.map(name => {
  const pattern = name.replaceAll('/', '\\/');
  const find = new RegExp(`^${pattern}$`);
  const replacement = webRequire.resolve(name);
  return { find, replacement };
});
const plugin = react();
const server = await createServer({ root, configFile: false, plugins: [plugin], resolve: { alias }, server: { host: '127.0.0.1', port: 5186, strictPort: true, fs: { allow: [workspace] } } });
await server.listen();
server.printUrls();
