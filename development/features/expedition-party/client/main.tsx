import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OnlineApp } from '../../../../apps/web/src/online/online-app';
import { CampView } from '../../../../apps/web/src/lobby/camp/camp-view';
import { Backpack } from '../../../../apps/web/src/lobby/backpack/backpack';
import { ArrivalAuth, ArrivalGate } from '../../../../apps/web/src/arrival/arrival';
import type { AuthViewProps, BackpackViewProps, LobbyViewProps, PartyViewProps } from '../../../../apps/web/src/online/lobby-view';
import { ExpeditionParty } from './party';

function renderLobby(props: LobbyViewProps) { return <CampView {...props} />; }
function renderAuth(props: AuthViewProps) { return <ArrivalAuth {...props} />; }
function renderBackpack(props: BackpackViewProps) { return <Backpack {...props} />; }
function renderParty(props: PartyViewProps) { return <ExpeditionParty {...props} />; }
const container = document.getElementById('root');
if (!container) throw new Error('找不到网页挂载节点');
const root = createRoot(container);
root.render(<StrictMode><ArrivalGate play={false}><OnlineApp renderLobby={renderLobby} renderAuth={renderAuth} renderBackpack={renderBackpack} renderParty={renderParty} /></ArrivalGate></StrictMode>);
