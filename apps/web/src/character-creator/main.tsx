import { createRoot } from 'react-dom/client';
import { CharacterCreator } from './creator';

const container = document.getElementById('root');
if (!container) throw new Error('找不到角色创建页面挂载节点');
const root = createRoot(container);
const app = <CharacterCreator />;
root.render(app);
