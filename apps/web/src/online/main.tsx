import { ExpeditionParty } from '../lobby/party/party';
import type { PartyViewProps } from './lobby-view';
import { preloadCampAssets } from '../lobby/camp/camp-assets';
import { Backpack } from '../lobby/backpack/backpack';
import type { BackpackViewProps } from './lobby-view';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OnlineApp, freshTestAccount } from './online-app';
import { CampView } from '../lobby/camp/camp-view';
import type { AuthViewProps, LobbyViewProps } from './lobby-view';
import { ArrivalAuth, ArrivalGate } from '../arrival/arrival';
import { TutorialProvider } from './tutorial/tutorial-context';

function renderParty(props: PartyViewProps) { return <ExpeditionParty {...props} />; }
function renderLobby(props: LobbyViewProps) { return <CampView {...props} />; }
function renderBackpack(props: BackpackViewProps) { return <Backpack {...props} />; }
function renderAuth(props: AuthViewProps) { return <ArrivalAuth {...props} />; }

if (freshTestAccount) preloadCampAssets();

const container = document.getElementById('root');
if (!container) throw new Error('找不到网页挂载节点');
const root = createRoot(container);
const query = new URLSearchParams(window.location.search);
const effectsEnabled = import.meta.env.DEV || import.meta.env.VITE_TEST_TOOLS === 'true';
if (effectsEnabled && query.get('effects') === 'loot') {
  void import('./loot-preview').then(module => { root.render(<StrictMode><module.LootPreview /></StrictMode>); });
} else if (effectsEnabled && query.get('effects') === 'spawns') {
  void import('./spawn-preview').then(module => { root.render(<StrictMode><module.SpawnPreview /></StrictMode>); });
} else root.render(<StrictMode><TutorialProvider><ArrivalGate play={freshTestAccount ? false : undefined}><OnlineApp renderLobby={renderLobby} renderAuth={renderAuth} renderBackpack={renderBackpack} renderParty={renderParty} /></ArrivalGate></TutorialProvider></StrictMode>);
