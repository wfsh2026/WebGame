import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';

const container = document.getElementById('root');
if (!container) throw new Error('找不到网页挂载节点');
const root = createRoot(container);
root.render(<StrictMode><App /></StrictMode>);
