import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OnlineApp } from '../../../../apps/web/src/online/online-app';
import { CampView } from '../../../../apps/web/src/lobby/camp/camp-view';
import { ArrivalAuth, ArrivalGate } from '../../../../apps/web/src/arrival/arrival';
import type { AuthViewProps, BackpackViewProps, LobbyViewProps } from '../../../../apps/web/src/online/lobby-view';
import { Backpack } from './backpack';

function renderLobby(props: LobbyViewProps) { return <CampView {...props} />; }
function renderAuth(props: AuthViewProps) { return <ArrivalAuth {...props} />; }
function renderBackpack(props: BackpackViewProps) { return <Backpack {...props} />; }
const container = document.getElementById('root');
if (!container) throw new Error('找不到网页挂载节点');
const root = createRoot(container);
root.render(<StrictMode><ArrivalGate><OnlineApp renderLobby={renderLobby} renderAuth={renderAuth} renderBackpack={renderBackpack} /></ArrivalGate></StrictMode>);
