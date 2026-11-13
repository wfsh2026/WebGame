import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import type { LobbyViewProps } from '../../apps/web/src/online/lobby-view';
import { CampView } from '../../apps/web/src/lobby/camp/camp-view';
import { ArrivalAuth, ArrivalGate } from '../../apps/web/src/arrival/arrival';
import type { AuthViewProps } from '../../apps/web/src/online/lobby-view';

function renderLobby(props: LobbyViewProps) { return <CampView {...props} />; }
function renderAuth(props: AuthViewProps) { return <ArrivalAuth {...props} />; }
const OnlineApp = lazy(async () => { const module = await import('../../apps/web/src/online/online-app'); return { default: module.OnlineApp }; });
const previewProps: LobbyViewProps = {
  profile: { id: 'scene-preview', name: '旅行者', role: 'forest-survival:character/ranger', coins: 0, materials: 0 },
  rooms: [], history: [], busy: false, error: '',
  enterRoom: async () => {}, logout: async () => {}
};
const query = new URLSearchParams(location.search);
const online = query.get('mode') === 'online';
const container = document.getElementById('root');
if (!container) throw new Error('找不到开发入口节点');
const root = createRoot(container);
root.render(<StrictMode>{online ? <ArrivalGate><Suspense fallback={<p>正在连接本地账号入口…</p>}><OnlineApp renderLobby={renderLobby} renderAuth={renderAuth} /></Suspense></ArrivalGate> : <CampView {...previewProps} preview />}</StrictMode>);

