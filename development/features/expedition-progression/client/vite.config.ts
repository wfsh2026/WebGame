import webConfig from '../../../../apps/web/vite.config';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const rootUrl = new URL('../../../web/', import.meta.url); const root = fileURLToPath(rootUrl);
const projectUrl = new URL('../../../../', import.meta.url); const project = fileURLToPath(projectUrl);
const packageUrl = new URL('../../../../apps/web/package.json', import.meta.url); const requireWeb = createRequire(packageUrl);
const alias = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', '@web-game-world/contracts', '@web-game-world/simulation'].map(name => {
  const replacement = requireWeb.resolve(name); return { find: name, replacement };
});
alias.reverse();
const inputUrl = new URL('../../../web/index.html', import.meta.url); const input = fileURLToPath(inputUrl);
export default { ...webConfig, root, resolve: { alias, dedupe: ['react', 'react-dom'] }, build: { rollupOptions: { input } }, server: { ...webConfig.server, port: 5181, strictPort: true, fs: { allow: [project] } } };
