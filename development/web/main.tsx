import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import type { LobbyViewProps } from '../../apps/web/src/online/lobby-view';
import { CampView } from '../../apps/web/src/lobby/camp/camp-view';
import { ArrivalAuth, ArrivalGate } from '../../apps/web/src/arrival/arrival';
import type { AuthViewProps } from '../../apps/web/src/online/lobby-view';

function renderLobby(props: LobbyViewProps) { return <CampView {...props} />; }
function renderAuth(props: AuthViewProps) { return <ArrivalAuth {...props} />; }
const OnlineApp = lazy(async () => { const module = await import('../../apps/web/src/online/online-app'); return { default: module.OnlineApp }; });
const ExpeditionProgressionReview = lazy(() => import('../features/expedition-progression/client/review'));
const ExpeditionReview = lazy(() => import('../features/expedition-ui/client/review'));
const BattleReview = lazy(() => import('../features/battle-ui/client/review'));
const GuardReview = lazy(() => import('../features/perfect-guard/client/review'));
const WaveRewardsReview = lazy(() => import('../features/growth-choice-ui/client/wave-review'));
const previewProps: LobbyViewProps = {
  profile: { id: 'scene-preview', name: '旅行者', role: 'forest-survival:character/ranger', coins: 0, materials: 0 },
  rooms: [], history: [], busy: false, error: '',
  enterRoom: async () => {}, logout: async () => {}
};
const query = new URLSearchParams(location.search);
const online = query.get('mode') === 'online';
const expeditionReview = query.get('view') === 'expeditions';
const container = document.getElementById('root');
if (!container) throw new Error('找不到开发入口节点');
const root = createRoot(container);
const expeditionProgression = query.get('view') === 'expedition-run';
const battleReview = query.get('view') === 'battle-ui';
const guardReview = query.get('view') === 'perfect-guard';
const waveRewardsReview = query.get('view') === 'wave-rewards';
root.render(<StrictMode>{guardReview ? <Suspense fallback={<p>正在加载格挡与精防…</p>}><GuardReview /></Suspense> : waveRewardsReview ? <Suspense fallback={<p>正在加载波次收获…</p>}><WaveRewardsReview /></Suspense> : battleReview ? <Suspense fallback={<p>正在加载战斗界面…</p>}><BattleReview /></Suspense> : expeditionProgression ? <Suspense fallback={<p>正在加载关卡与地狱续战…</p>}><ExpeditionProgressionReview /></Suspense> : expeditionReview ? <Suspense fallback={<p>正在加载秘境界面…</p>}><ExpeditionReview /></Suspense> : online ? <ArrivalGate><Suspense fallback={<p>正在连接本地账号入口…</p>}><OnlineApp renderLobby={renderLobby} renderAuth={renderAuth} /></Suspense></ArrivalGate> : <CampView {...previewProps} preview />}</StrictMode>);

