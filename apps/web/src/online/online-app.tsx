import { expeditionAccessSchema } from '@web-game-world/contracts';
import type { ExpeditionActionData, ExpeditionDifficultyData } from '@web-game-world/contracts';
import type { RefreshGrowthData } from '@web-game-world/contracts';
import { ClientBattle } from '../network/client-battle';
import { PauseMenu } from './pause-menu';
import { predictGrowth } from './instant-growth';
import type { PendingGrowth } from './instant-growth';
import { lootPickupSchema, lootStateSchema } from '@web-game-world/contracts';
import type { LootStateData } from '@web-game-world/contracts';
import { BuildPanel } from './build-panel';
import { buildStateSchema } from '@web-game-world/contracts';
import type { BuildStateData } from '@web-game-world/contracts';
import { testInventoryReceiptSchema } from '@web-game-world/contracts';
import { testAssetsSchema } from '@web-game-world/contracts';
import type { TestAssetAdjustmentData } from '@web-game-world/contracts';
import { inventoryStateSchema } from '@web-game-world/contracts';
import { shopStateSchema } from '@web-game-world/contracts';
import type { ShopPurchaseData, ShopRefreshData } from '@web-game-world/contracts';
import { equipmentStateSchema } from '@web-game-world/contracts';
import type { EquipmentLoadoutData, EquipmentStateData } from '@web-game-world/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OnlineAppProps } from './lobby-view';
import { BattleRuntime } from '../game/battle-runtime';
import type { BattleLoading } from '../game/battle-runtime';
import type { Room } from 'colyseus.js';
import { compactSnapshotSchema, snapshotSchema, protocolVersion } from '@web-game-world/contracts';
import type { Profile, Snapshot } from '@web-game-world/contracts';
import { fetchProfile, request, loginResultSchema, roomClient, roomListSchema, historySchema } from '../network/online';
import type { SceneBridge } from '../game/online-scene';
import s from './online.module.css';
import { CharacterCreator } from '../character-creator/creator';
import { appVersion } from '../app-version';
import { CombatHud } from '../hud/combat-hud';
import { PickupNotices } from '../hud/pickup-notices';
import { PickupNoticeFeed } from '../hud/pickup-notice-feed';
import { SurvivalOverlay } from './survival-overlay';
import { ExpeditionResult } from './expedition-result';
import { profileSchema } from '@web-game-world/contracts';
import type { CharacterBuildData, CharacterGrowthSaveData, CharacterUpgradeData } from '@web-game-world/contracts';
import { calculateCharacterStats, characterTalents, defaultCharacterPoints } from '@web-game-world/simulation';
import { useTutorial } from './tutorial/tutorial-context';

export const freshTestAccount = import.meta.env.BASE_URL === '/online-test/';
const storageKey = 'web-game-world.online-token.v1';
const roomKey = 'web-game-world.online-room.v1';
function readToken(): string { if (freshTestAccount) return ''; try { return sessionStorage.getItem(storageKey) ?? ''; } catch { return ''; } }
function rememberToken(token: string): void { if (freshTestAccount) return; try { sessionStorage.setItem(storageKey, token); } catch { /* 私密模式下仍可在当前页面使用。 */ } }
function message(error: unknown): string {
  if (error instanceof Error && error.name === 'TimeoutError') return '连接超时，请稍后重试';
  if (error instanceof TypeError || error instanceof SyntaxError) return '暂时无法连接游戏服务，请稍后重试';
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}
const stageNames = { waiting: '组队准备', rest: '秘境大厅', combat: '林地围猎', 'round-result': '波次结算', settling: '正在结算奖励', 'final-result': '秘境最终结算' };
const profilePromiseCache = new Map<string, Promise<Profile>>();
function cachedProfile(token: string): Promise<Profile> { let promise = profilePromiseCache.get(token); if (!promise) { promise = fetchProfile(token); profilePromiseCache.set(token, promise); } return promise; }
function ArenaView({ runtime }: { runtime: BattleRuntime }) {
  const parent = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState(runtime.feedbackSettings);
  function adjustFeedback(change: Partial<typeof feedback>): void { const next = { ...feedback, ...change }; setFeedback(next); runtime.setFeedback(next); }
  const [loading, setLoading] = useState<BattleLoading>({ progress: 0, ready: false, error: '' });
  useEffect(() => {
    const unsubscribe = runtime.subscribe(setLoading);
    if (parent.current) runtime.attach(parent.current);
    return () => { unsubscribe(); runtime.detach(); };
  }, [runtime]);
  const percent = Math.round(loading.progress * 100);
  return <><div className={s.arena} ref={parent} /><details className={s.feedbackSettings}><summary>战斗反馈</summary>
    <label><input type="checkbox" checked={feedback.sound} onChange={event => { const sound = event.target.checked; adjustFeedback({ sound }); }} />战斗音效</label>
    <label>震屏<select value={feedback.shake} onChange={event => { const shake = Number(event.target.value); adjustFeedback({ shake }); }}><option value={0}>关闭</option><option value={.35}>轻微</option><option value={.65}>标准</option><option value={1}>强烈</option></select></label>
    <label>闪光<select value={feedback.flash} onChange={event => { const flash = Number(event.target.value); adjustFeedback({ flash }); }}><option value={0}>关闭</option><option value={.35}>柔和</option><option value={.75}>标准</option><option value={1}>强烈</option></select></label>
    </details>{!loading.ready && <section className={s.loadingBattle} role="status">
    <strong>{loading.error || (percent < 100 ? `正在准备秘境 ${percent}%` : '正在准备战斗画面…')}</strong>
    <progress max={100} value={percent} aria-label="秘境资源加载进度" />
    {loading.error && <button onClick={() => runtime.retry()}>重新加载</button>}
  </section>}</>;
}
export function OnlineApp({ renderLobby, renderAuth, renderBackpack, renderParty }: OnlineAppProps) {
  const [token, setToken] = useState(readToken); const [profile, setProfile] = useState<Profile | null>(null); const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [login, setLogin] = useState(true);
  const guide = useTutorial();
  const guideAccountId = profile?.role ? profile.id : '';
  useEffect(() => { const session = { token, accountId: guideAccountId }; guide.connect(session); }, [token, guideAccountId, guide.connect]);
  const serverBuild = useRef<BuildStateData | null>(null);
  const pendingGrowth = useRef<PendingGrowth[]>([]);
  const visibleBuild = useRef<BuildStateData | null>(null);
  const [build, setBuild] = useState<BuildStateData | null>(null);
  const [buildError, setBuildError] = useState('');
  const [unlockedDifficulties, setUnlockedDifficulties] = useState<ExpeditionDifficultyData[]>(['normal']);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [rooms, setRooms] = useState<{ roomId: string; clients: number; maxClients: number; name: string; difficulty?: ExpeditionDifficultyData }[]>([]); const [roomCode, setRoomCode] = useState(''); const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [connection, setConnection] = useState(''); const [history, setHistory] = useState<ReturnType<typeof historySchema.parse>>([]);
  const initiallyRestoring = token.length > 0;
  const [restoring, setRestoring] = useState(initiallyRestoring);
  const [entryStep, setEntryStep] = useState(0);
  const testAccountPromise = useRef<Promise<void> | null>(null);
  const room = useRef<Room | null>(null); const sequence = useRef(0); const reconnecting = useRef(false);
  const hudClock = useRef(0);
  const [loot, setLoot] = useState<LootStateData>({ revision: 0, safe: [], consumables: [] });
  const [lootNotice, setLootNotice] = useState('');
  const [pickupFeed] = useState(() => new PickupNoticeFeed());
  useEffect(() => {
    if (snapshot?.stage !== 'combat') pickupFeed.clear();
  }, [snapshot?.stage, pickupFeed]);
  useEffect(() => pickupFeed.clear, [pickupFeed]);
  useEffect(() => {
    if (!lootNotice) return;
    const timer = window.setTimeout(() => setLootNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [lootNotice]);
  function lootTarget(kind: string): { x: number; y: number } | undefined {
    const selector = `[data-loot-target="${kind}"]`; const button = document.querySelector<HTMLElement>(selector);
    if (!button) return; const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  function lootLanded(kind: string): void {
    const selector = `[data-loot-target="${kind}"]`; const button = document.querySelector<HTMLElement>(selector);
    const frames = [{ filter: 'brightness(2)', transform: 'scale(1.08)' }, { filter: 'brightness(1)', transform: 'scale(1)' }];
    button?.animate(frames, { duration: 400 });
  }
  const bridge = useRef<SceneBridge>({ current: null, playerId: '', pickups: [], lootTarget, lootLanded, send: input => { if (!room.current || bridge.current.battle?.owner === bridge.current.playerId) return; sequence.current += 1; const data = { ...input, sequence: sequence.current }; room.current.send('input', data); } });
  const runtimeRef = useRef<BattleRuntime | null>(null);
  if (!runtimeRef.current) runtimeRef.current = new BattleRuntime(bridge.current);
  const runtime = runtimeRef.current;
  useEffect(() => {
    if (!profile?.role) return;
    const timer = window.setTimeout(() => runtime.prepare(), 150);
    return () => window.clearTimeout(timer);
  }, [profile?.role, runtime]);
  useEffect(() => () => { bridge.current.battle?.dispose(); runtime.dispose(); }, [runtime]);
  function reportError(cause: unknown): void { const detail = message(cause); setError(detail); }
  async function refreshLobby(): Promise<void> {
    const roomRequest = request('rooms', { token }); const historyRequest = request('history', { token }); const accessRequest = request('expedition-access', { token });
    const responses = await Promise.all([roomRequest, historyRequest, accessRequest]);
    const available = roomListSchema.parse(responses[0]); const items = historySchema.parse(responses[1]); const access = expeditionAccessSchema.parse(responses[2]);
    setRooms(available); setHistory(items); setUnlockedDifficulties(access.unlocked);
  }
  async function loadProfile(): Promise<void> { const current = await fetchProfile(token); setProfile(current); }
  function attach(next: Room): void {
    room.current = next; sequence.current = Date.now() % 1000000000; setConnection('已连接权威房间');
    try { sessionStorage.setItem(roomKey, next.reconnectionToken); } catch { /* 页面内连接仍可继续。 */ }
    serverBuild.current = null; visibleBuild.current = null; pendingGrowth.current = [];
    setBuild(null); setBuildError(''); setLoot({ revision: 0, safe: [], consumables: [] }); bridge.current.pickups = [];
    pickupFeed.reset(next.roomId);
    next.onMessage('build-fusion', (raw: unknown) => { if (typeof raw === 'string') setLootNotice(raw); });
    next.onMessage('preparation-notice', (raw: unknown) => { if (typeof raw === 'string') setLootNotice(raw); });
    next.onMessage('loot-state', (raw: unknown) => { const parsed = lootStateSchema.safeParse(raw); if (parsed.success) setLoot(parsed.data); });
    next.onMessage('loot-pickup', (raw: unknown) => {
      if (room.current !== next) return;
      const parsed = lootPickupSchema.safeParse(raw);
      if (!parsed.success) return;
      const event = parsed.data; bridge.current.pickups.push(event);
      if (event.playerId === bridge.current.playerId) pickupFeed.receive(event);
    });
    next.onMessage('growth-refresh-receipt', () => { setBuildError(''); });
    next.onMessage('growth-receipt', (raw: unknown) => {
      if (!raw || typeof raw !== 'object' || !('choiceId' in raw) || typeof raw.choiceId !== 'number') return;
      const entry = pendingGrowth.current.find(item => item.choiceId === raw.choiceId);
      if (entry) entry.confirmed = true;
      guide.mark('reward-picked');
    });
    next.onMessage('build-state', (raw: unknown) => {
      const parsed = buildStateSchema.safeParse(raw); if (!parsed.success) return;
      serverBuild.current = parsed.data;
      pendingGrowth.current = pendingGrowth.current.filter(item => !item.confirmed && parsed.data.choices.some(choice => choice.id === item.choiceId));
      let state = parsed.data;
      for (const request of pendingGrowth.current) { const prediction = predictGrowth(state, undefined, request); state = prediction.state; }
      visibleBuild.current = state; setBuild(state); setBuildError('');
    });
    next.onMessage('build-error', (raw: unknown) => { if (typeof raw === 'string') setBuildError(raw); });
    const applySnapshot = (current: Snapshot): void => {
      if (serverBuild.current && pendingGrowth.current.length) {
        let state = serverBuild.current; let mine = current.players.find(player => player.id === bridge.current.playerId);
        for (const request of pendingGrowth.current) {
          if (request.confirmed) { const accepted = predictGrowth(state, undefined, request); state = accepted.state; continue; }
          const prediction = predictGrowth(state, mine, request); state = prediction.state; mine = prediction.player;
        }
        const players = current.players.map(player => mine && player.id === mine.id ? mine : player);
        current = { ...current, players };
      }
      const previous = bridge.current.current; bridge.current.current = current;
      const now = performance.now();
      const preparationChanged = Boolean(previous?.preparation) !== Boolean(current.preparation) || Boolean(previous?.resting) !== Boolean(current.resting);
      const phaseChanged = previous?.stage !== current.stage || previous?.round !== current.round || previous?.paused !== current.paused || preparationChanged;
      if (phaseChanged || current.stage !== 'combat' || now - hudClock.current >= 250) { hudClock.current = now; setSnapshot(current); }
    };
    next.onMessage('snapshot', (raw: unknown) => {
      const parsed = snapshotSchema.safeParse(raw);
      if (!parsed.success) { setError('服务器协议不兼容，请刷新页面'); return; }
      applySnapshot(parsed.data);
    });
    next.onMessage('snapshot-compact', (raw: unknown) => {
      const parsed = compactSnapshotSchema.safeParse(raw);
      const previous = bridge.current.current;
      if (!parsed.success || !previous || previous.roomId !== next.roomId) { setError('战斗同步数据异常，请重新连接'); return; }
      const packet = parsed.data;
      const entries = previous.players.map(player => [player.id, player] as const);
      const oldPlayers = new Map(entries);
      const players = packet.players.map(player => {
        const old = oldPlayers.get(player.id);
        return { ...player, buildItems: player.buildItems ?? old?.buildItems, loadout: player.loadout ?? old?.loadout };
      });
      const snapshot = { ...packet, wavePlans: packet.wavePlans ?? previous.wavePlans, players, results: packet.results ?? previous.results, rewards: packet.rewards ?? previous.rewards };
      applySnapshot(snapshot);
    });
    bridge.current.battle?.dispose(); bridge.current.battle = new ClientBattle(next, setError);
    next.send('compact-snapshots', true);
    next.onError((code, detail) => { setError(`房间连接错误 ${code}：${detail ?? '请稍后重试'}`); });
    next.onLeave((code) => {
      if (room.current !== next) return;
      bridge.current.battle?.dispose();
      if (code === 1000 || code === 4000) { room.current = null; return; }
      room.current = null; setConnection('连接中断，正在尝试重连…'); void reconnect(next.reconnectionToken);
    });
  }
  async function reconnect(reconnectionToken: string): Promise<void> {
    if (reconnecting.current) return; reconnecting.current = true;
    const deadline = Date.now() + 28000;
    while (Date.now() < deadline) {
      try { const client = roomClient(); const next = await client.reconnect(reconnectionToken); attach(next); reconnecting.current = false; return; }
      catch { await new Promise(resolve => window.setTimeout(resolve, 1500)); }
    }
    reconnecting.current = false; sessionStorage.removeItem(roomKey); setConnection('重连失败'); setError('重连宽限期已结束，请返回大厅');
  }
  useEffect(() => { if (!token) { setRestoring(false); return; } let alive = true; const promise = cachedProfile(token); void promise.then(current => { if (!alive) return; setProfile(current); bridge.current.playerId = current.id; const saved = freshTestAccount ? null : sessionStorage.getItem(roomKey); if (saved && !room.current && !reconnecting.current) void reconnect(saved); }).catch(cause => { if (alive) { profilePromiseCache.delete(token); reportError(cause); setToken(''); rememberToken(''); } }).finally(() => { if (alive) setRestoring(false); }); return () => { alive = false; }; }, [token]);
  useEffect(() => { if (!profile?.role || snapshot) return; void refreshLobby().catch(cause => reportError(cause)); const interval = window.setInterval(() => { void refreshLobby().catch(cause => reportError(cause)); }, 6000); return () => window.clearInterval(interval); }, [profile?.role, snapshot === null]);
  async function createTestAccount(): Promise<void> {
    setBusy(true); setError(''); setEntryStep(0);
    try {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const parts = Array.from(bytes, value => value.toString(16).padStart(2, '0'));
      const secret = parts.join('');
      const suffix = secret.slice(0, 16);
      const body = { name: `test${suffix}`, password: secret };
      const data = await request('register', { body });
      const result = loginResultSchema.parse(data);
      setEntryStep(1);
      const character = { name: '测试冒险者', description: '', points: defaultCharacterPoints, talents: [] };
      const options = { token: result.token, body: { role: 'forest-survival:character/ranger', character } };
      const initialized = await request('character', options);
      const current = profileSchema.parse(initialized);
      const preparedProfile = Promise.resolve(current);
      profilePromiseCache.set(result.token, preparedProfile);
      setEntryStep(2);
      setProfile(current); setToken(result.token); bridge.current.playerId = current.id;
    } catch (cause) { reportError(cause); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!freshTestAccount || testAccountPromise.current) return;
    testAccountPromise.current = createTestAccount();
  }, []);
  function retryTestAccount(): void { testAccountPromise.current = createTestAccount(); }
  async function authenticate(event: React.FormEvent): Promise<void> { event.preventDefault(); setBusy(true); setError(''); try { const body = { name, password }; const path = login ? 'login' : 'register'; const data = await request(path, { body }); const result = loginResultSchema.parse(data); rememberToken(result.token); setToken(result.token); setProfile(result.profile); bridge.current.playerId = result.profile.id; setPassword(''); } catch (cause) { reportError(cause); } finally { setBusy(false); } }
  async function selectCharacter(character: CharacterBuildData): Promise<void> {
    const body = { role: 'forest-survival:character/ranger', character };
    const options = { token, body };
    try {
      const result = await request('character', options);
      const current = profileSchema.parse(result); setProfile(current);
    } catch (cause) {
      // 响应超时后查询已创建结果，避免重复创建或丢失已保存配置。
      try { const current = await fetchProfile(token); if (current.role) { setProfile(current); return; } } catch { /* 保留原错误与编辑内容。 */ }
      throw cause;
    }
  }
  const loadInventory = useCallback(async () => {
    const options = { token };
    const result = await request('inventory', options);
    return inventoryStateSchema.parse(result);
  }, [token]);
  const loadEquipment = useCallback(async (): Promise<EquipmentStateData> => {
    const options = { token };
    const result = await request('equipment', options);
    return equipmentStateSchema.parse(result);
  }, [token]);
  const saveEquipment = useCallback(async function saveEquipment(data: { loadout: EquipmentLoadoutData; revision: number }): Promise<EquipmentStateData> {
    const options = { token, body: data };
    const result = await request('equipment', options);
    const current = equipmentStateSchema.parse(result);
    setProfile(previous => previous ? { ...previous, loadout: current.loadout } : previous);
    profilePromiseCache.delete(token);
    void guide.refresh();
    return current;
  }, [token, guide.refresh]);
  const mutateCharacter = useCallback(async (path: string, data: CharacterUpgradeData | CharacterGrowthSaveData) => {
    const options = { token, body: data };
    try {
      const response = await request(path, options);
      const current = profileSchema.parse(response);
      setProfile(current); profilePromiseCache.delete(token);
      void guide.refresh();
      return current;
    } catch (cause) {
      profilePromiseCache.delete(token);
      try { const current = await fetchProfile(token); setProfile(current); void guide.refresh(); } catch { /* 保留原始操作错误供重试。 */ }
      throw cause;
    }
  }, [token, guide.refresh]);
  const upgradeCharacter = useCallback((data: CharacterUpgradeData) => mutateCharacter('character/upgrade', data), [mutateCharacter]);
  const saveCharacterGrowth = useCallback((data: CharacterGrowthSaveData) => mutateCharacter('character/growth', data), [mutateCharacter]);
  const copyEquipment = useCallback(async (data: { requestId: string; revision: number; coins: number }) => {
    const options = { token, body: data };
    const response = await request('equipment/copy', options);
    const current = equipmentStateSchema.parse(response);
    setProfile(previous => previous ? { ...previous, coins: current.coins, loadout: current.loadout } : previous);
    profilePromiseCache.delete(token);
    void guide.refresh();
    return current;
  }, [token, guide.refresh]);
  const loadShop = useCallback(async () => {
    const options = { token };
    const response = await request('shop', options);
    const current = shopStateSchema.parse(response);
    setProfile(previous => previous ? { ...previous, coins: current.coins, materials: current.materials } : previous);
    profilePromiseCache.delete(token);
    void guide.refresh();
    return current;
  }, [token, guide.refresh]);
  const purchaseProduct = useCallback(async (data: ShopPurchaseData) => {
    const options = { token, body: data };
    const response = await request('shop/purchase', options);
    const current = shopStateSchema.parse(response);
    setProfile(previous => previous ? { ...previous, coins: current.coins, materials: current.materials } : previous);
    profilePromiseCache.delete(token);
    void guide.refresh();
    return current;
  }, [token, guide.refresh]);
  const refreshShop = useCallback(async (data: ShopRefreshData) => {
    const options = { token, body: data };
    const response = await request('shop/refresh', options);
    const current = shopStateSchema.parse(response);
    setProfile(previous => previous ? { ...previous, coins: current.coins, materials: current.materials } : previous);
    profilePromiseCache.delete(token);
    return current;
  }, [token]);
  const addTestInventory = useCallback(async (requestId: string) => {
    const options = { token, body: { requestId } };
    const response = await request('test-tools/inventory', options);
    const receipt = testInventoryReceiptSchema.parse(response);
    return receipt.addedTypes;
  }, [token]);
  const loadTestAssets = useCallback(async () => {
    const options = { token };
    const response = await request('test-tools/assets', options);
    const assets = testAssetsSchema.parse(response);
    setProfile(previous => previous ? { ...previous, ...assets } : previous);
    profilePromiseCache.delete(token);
    return assets;
  }, [token]);
  const adjustTestAssets = useCallback(async (data: TestAssetAdjustmentData) => {
    const options = { token, body: data };
    const response = await request('test-tools/assets', options);
    const assets = testAssetsSchema.parse(response);
    setProfile(previous => previous ? { ...previous, ...assets } : previous);
    profilePromiseCache.delete(token);
    return assets;
  }, [token]);
  async function enterRoom(id?: string, difficulty: ExpeditionDifficultyData = 'normal'): Promise<void> { runtime.prepare(); setBusy(true); setError(''); try { const client = roomClient(); const options = { token, protocol: protocolVersion, difficulty }; const next = id ? await client.joinById(id, options) : await client.create('expedition', options); attach(next); } catch (cause) { reportError(cause); } finally { setBusy(false); } }
  async function returnLobby(): Promise<void> { bridge.current.battle?.dispose(); bridge.current.battle = undefined; setBusy(true); try { const current = room.current; room.current = null; if (current) await current.leave(); sessionStorage.removeItem(roomKey); bridge.current.current = null; setSnapshot(null); setConnection(''); setError(''); await loadProfile(); await refreshLobby(); void guide.refresh(); } catch (cause) { reportError(cause); } finally { setBusy(false); } }
  async function logout(): Promise<void> { if (freshTestAccount) { window.location.reload(); return; } try { await request('logout', { token, method: 'POST' }); } catch { /* 清除本地会话。 */ } profilePromiseCache.delete(token); rememberToken(''); sessionStorage.removeItem(roomKey); setToken(''); setProfile(null); setPassword(''); setError(''); }
  function ready(): void { const mine = snapshot?.players.find(player => player.id === profile?.id); room.current?.send('ready', !mine?.ready); }
  function changeDifficulty(difficulty: ExpeditionDifficultyData): void { setError(''); room.current?.send('change-difficulty', difficulty); }
  function start(): void { room.current?.send('start'); }
  function chooseUpgrade(choiceId: number, index: number, targetId?: string): void {
    const state = visibleBuild.current; const current = bridge.current.current;
    const choice = state?.choices.find(item => item.id === choiceId);
    if (!room.current || !choice) return;
    setBuildError('');
    if (choice.source === 'level' && state) {
      const request: PendingGrowth = { choiceId, index, confirmed: false };
      const mine = current?.players.find(player => player.id === bridge.current.playerId);
      const prediction = predictGrowth(state, mine, request);
      pendingGrowth.current.push(request); visibleBuild.current = prediction.state; setBuild(prediction.state); setBuildError('');
      if (current && prediction.player) {
        const player = prediction.player;
        const players = current.players.map(item => item.id === player.id ? player : item);
        const snapshot = { ...current, players }; bridge.current.current = snapshot; setSnapshot(snapshot);
      }
    }
    const request = { choiceId, index, targetId }; room.current.send('choose-growth', request);
  }
  function refreshGrowth(data: RefreshGrowthData): void { setBuildError(''); room.current?.send('refresh-growth', data); }
  function discardBattle(id: string): void { setBuildError(''); room.current?.send('discard-build-item', id); }
  function equipBattle(loadout: EquipmentLoadoutData, revision: number): void { setBuildError(''); const request = { loadout, revision }; room.current?.send('battle-equipment', request); }
  function waveReady(ready: boolean, solo: boolean): void {
    const current = bridge.current.current; const round = current?.round;
    if (!round || !current?.resting) return;
    const singleParticipant = current.preparation?.participantIds.length === 1;
    if (solo !== singleParticipant) return;
    if (ready && solo) { room.current?.send('start-wave', round); return; }
    const data = { round, ready }; room.current?.send('wave-ready', data);
  }
  function chooseExpedition(data: ExpeditionActionData): void { setBuildError(''); room.current?.send('expedition-action', data); }
  function remindReady(): void { const round = bridge.current.current?.round; if (round) room.current?.send('remind-ready', round); }
  function pauseBattle(paused: boolean): void { room.current?.send('pause', paused); }
  function revive(): void { room.current?.send('revive'); }
  const mine = snapshot?.players.find(player => player.id === profile?.id);
  const personalReward = snapshot?.rewards?.find(reward => reward.id === profile?.id);
  const hasPersonalReward = Boolean(personalReward);
  useEffect(() => {
    if (snapshot?.stage === 'combat') guide.mark('combat-entered');
    if (hasPersonalReward) void guide.refresh();
  }, [snapshot?.stage, hasPersonalReward, guide.data?.enabled, guide.mark, guide.refresh]);
  const phase = snapshot ? snapshot.stage === 'waiting' && snapshot.players.length === 1 ? '单人冒险' : stageNames[snapshot.stage] : '游戏大厅';
  function changeMode(): void { setLogin(!login); setError(''); setPassword(''); }
  if (profile && snapshot && renderParty && (snapshot.stage === 'waiting' || snapshot.stage === 'rest')) {
    const partyProps = { changeDifficulty, unlockedDifficulties, snapshot, playerId: profile.id, busy, connection, error: error || snapshot.error, ready, start, leave: returnLobby };
    return renderParty(partyProps);
  }
  if (snapshot && profile && (snapshot.stage === 'final-result' || hasPersonalReward)) {
    const resultProps = { expedition: snapshot.expedition, playerId: profile.id, name: mine?.name ?? profile.name, results: snapshot.results, reward: personalReward, busy, error: error || snapshot.error, onClose: returnLobby };
    return <ExpeditionResult {...resultProps} />;
  }
  if (!profile && freshTestAccount) return <main className={s.shell}><section className={s.panel}><h2>进入测试大厅</h2><p>每次打开或刷新页面都会创建全新账号，使用默认角色。</p>{error ? <><p role="alert">{error}</p><button disabled={busy} onClick={retryTestAccount}>重新进入</button></> : <div role="status"><progress max={2} value={entryStep} aria-label="账号准备进度" style={{ width: '100%' }} /><p>{entryStep === 0 ? '正在创建全新账号…（1/2）' : '正在初始化默认角色…（2/2）'}</p><small>完成后加载大厅场景</small></div>}</section></main>;
  if (!profile && renderAuth) {
    const authProps = { name, password, login, busy, restoring, error, changeName: setName, changePassword: setPassword, changeMode, authenticate };
    return renderAuth(authProps);
  }
  if (snapshot?.stage === 'combat') {
    const abilities = mine?.abilities ?? [];

    return <main className={s.battleShell}>
      <PauseMenu snapshot={snapshot} runtime={runtime} change={pauseBattle} connection={connection} />
      <ArenaView runtime={runtime} />
      <PickupNotices feed={pickupFeed} />
      {lootNotice && <div className={s.lootNotice} role="status">{lootNotice}</div>}
      {build && <BuildPanel connected={connection === '已连接权威房间'} snapshot={snapshot} waveReady={waveReady} remind={remindReady} resting={snapshot.resting ?? false} loot={loot} player={mine} discard={discardBattle} state={build} error={buildError} refresh={refreshGrowth} choose={chooseUpgrade} equip={equipBattle} decide={chooseExpedition} />}
      {mine && <CombatHud player={mine} players={snapshot.players} abilities={abilities} runtime={runtime} />}
      <SurvivalOverlay expedition={snapshot.expedition} coins={Math.max(0, (build?.coinsEarned ?? 0) - (build?.coinsSpent ?? 0))} plans={snapshot.wavePlans} preparation={snapshot.preparation} enemies={snapshot.enemies.filter(enemy => enemy.hp > 0).length} warnings={snapshot.spawnWarnings ?? []} pending={snapshot.pendingSpawns ?? 0} round={snapshot.round} seconds={snapshot.seconds} survived={mine?.survivalSeconds ?? 0} resting={snapshot.resting ?? false} living={snapshot.players.filter(player => player.hp > 0).length} total={snapshot.players.length} />
      {mine && mine.hp <= 0 && <section className={s.soulPanel} role="status"><b>灵魂状态 · 可使用 WASD 移动</b><p>无法攻击，继续累计生存与波次收益。</p><button onClick={revive} disabled={mine.reviveRemaining > 0}>{mine.reviveRemaining > 0 ? `${Math.ceil(mine.reviveRemaining)} 秒后可以复活` : '在灵魂当前位置复活'}</button></section>}
      {(error || snapshot.error) && <div className={s.battleError} role="alert">{error || snapshot.error}</div>}
      {connection !== '已连接权威房间' && <div className={s.battleConnection} role="status">{connection}</div>}
    </main>;
  }
  if (profile && !profile.role) return <CharacterCreator onCreate={selectCharacter} onExit={logout} />;
  const character = profile?.character;
  const characterStats = character ? calculateCharacterStats(character, profile?.characterGrowth) : null;
  const talentNames = character ? characterTalents.filter(talent => character.talents.includes(talent.id)).map(talent => talent.name).join(' · ') : '';
  if (profile?.role && !snapshot && renderLobby) { const lobbyProps = { unlockedDifficulties, upgradeCharacter, saveCharacterGrowth, copyEquipment, profile, rooms, history, busy: busy || reconnecting.current, error, enterRoom, logout, loadEquipment, saveEquipment, loadShop, purchaseProduct, refreshShop, loadInventory, renderBackpack, addTestInventory: import.meta.env.VITE_TEST_TOOLS === 'true' ? addTestInventory : undefined, loadTestAssets: import.meta.env.VITE_TEST_TOOLS === 'true' ? loadTestAssets : undefined, adjustTestAssets: import.meta.env.VITE_TEST_TOOLS === 'true' ? adjustTestAssets : undefined }; return renderLobby(lobbyProps); }
  return <div className={s.shell}><header className={s.header}><div><span className={s.eyebrow}>INTO THE RIFT · ONLINE</span><h1>林地围猎</h1></div><div className={s.account}>{profile && <><b>{profile.name}</b><span>金币 {profile.coins} · 经营素材 {profile.materials}</span>{!snapshot && <button className={s.ghost} onClick={logout}>退出账号</button>}</>}</div></header>
    <main className={s.main}>{error && <div className={s.error} role="alert">{error}</div>}{snapshot?.error && <div className={s.error} role="alert">{snapshot.error}</div>}
    {!profile ? <section className={s.auth}><span className={s.eyebrow}>第一段旅程，从这里开始</span><h2>{login ? '欢迎回来' : '创建冒险者账号'}</h2><p>真实联机 · 自动战斗 · 持续波次</p><form onSubmit={authenticate}><label>账号<input autoComplete="username" value={name} minLength={2} maxLength={20} onChange={event => setName(event.target.value)} required /></label><label>密码<input type="password" autoComplete={login ? 'current-password' : 'new-password'} value={password} minLength={8} maxLength={72} onChange={event => setPassword(event.target.value)} required /></label><button disabled={busy}>{busy ? '正在连接…' : login ? '登录' : '创建账号'}</button></form><button className={s.ghost} onClick={() => setLogin(!login)}>{login ? '创建新账号' : '已有账号，去登录'}</button></section>
    : !snapshot ? <>{character && characterStats && <section className={s.characterCard}><div><span className={s.eyebrow}>你的冒险者</span><h3>{character.name}</h3><p>{character.description || '每一种取舍，都成为你的天赋。'}</p><div className={s.tags}><span>{talentNames || '纯粹属性 · 无天赋'}</span></div></div><div className={s.characterNumbers}><span>生命 <b>{characterStats.maxHp}</b></span><span>灵力容量加成 <b>{characterStats.energyCapacityBonus}</b></span><span>物攻 <b>{characterStats.physicalAttack}</b></span><span>魔攻 <b>{characterStats.magicalAttack}</b></span></div></section>}<div className={s.intro}><span className={s.eyebrow}>冒险者营地</span><h2>与同行者一起，穿过林地。</h2><p>最多二十人协作。持续迎战怪潮，全员灵魂后结算。</p></div><div className={s.columns}><section className={s.panel}><span className={s.eyebrow}>01 · 完整秘境</span><h2>森语遗迹 · 林地围猎</h2><p>怪物随波次和入场人数增强。清空本波后休息，单人点击开始下一波，组队全员准备后继续。灵魂可移动并等待复活，全员灵魂即失败。</p><div className={s.tags}><span>自动攻击</span><span>共享战场</span><span>持续生存</span></div><button disabled={busy || reconnecting.current} onClick={() => { void enterRoom(); }}>创建房间</button><div className={s.join}><input aria-label="房间编号" placeholder="输入好友的房间编号" value={roomCode} onChange={event => setRoomCode(event.target.value)} /><button disabled={busy || !roomCode.trim()} onClick={() => { const id = roomCode.trim(); void enterRoom(id); }}>加入</button></div>{connection && <p role="status">{connection}</p>}</section><section className={s.panel}><h3>等待中的房间</h3>{rooms.length ? rooms.map(item => <div className={s.roomRow} key={item.roomId}><div><b>{item.name}</b><small>{item.roomId} · {item.clients}/{item.maxClients} 人</small></div><button disabled={busy} onClick={() => { void enterRoom(item.roomId); }}>加入</button></div>) : <p>暂无等待房间，创建一个邀请好友吧。</p>}</section></div><section className={s.panel}><h3>最近的秘境记录</h3>{history.length ? history.map(item => <div className={s.roomRow} key={item.runId}><span>{item.run.createdAt.slice(0, 16).replace('T', ' ')} · {item.run.status === 'completed' ? '已完成' : item.run.status === 'failed' ? '挑战结束' : '进行中 / 中断'}</span><span>{item.settled ? `金币 +${item.coins} · 素材 +${item.materials}` : '尚未结算'}</span></div>) : <p>完成第一次秘境后，在这里查看收获。</p>}</section></>
    : <><div className={s.phase}><div><span className={s.eyebrow}>{connection} · 房间 {snapshot.roomId}</span><h2>{phase}{snapshot.round > 0 && ` · 第 ${snapshot.round} 轮`}</h2></div><div className={s.timer}>{snapshot.stage === 'rest' ? `${Math.ceil(snapshot.seconds)} 秒后统一出发` : ''}</div></div>
      <section className={s.panel}>{snapshot.stage === 'waiting' && <><h3>{snapshot.players.length === 1 ? '单人冒险' : '等待同行者'}</h3><p>复制房间编号给好友：<strong>{snapshot.roomId}</strong>。{snapshot.players.length === 1 ? '可直接开启秘境。' : '所有成员准备后，房主开启。'}开局后不接受新玩家。</p>{snapshot.players.length > 1 && <button onClick={ready}>{mine?.ready ? '取消准备' : '准备'}</button>}{snapshot.hostId === profile.id && <button onClick={start} disabled={busy || connection !== '已连接权威房间' || snapshot.players.some(player => !player.connected || snapshot.players.length > 1 && !player.ready)}>开启秘境</button>}</>}
      {snapshot.stage === 'rest' && <><h3>准备进入林地</h3><p>倒计时结束后全员进入。此后原地连续刷新波次，完成20关后可提取收益，或选择地狱20层高风险挑战。</p></>}
      {(snapshot.stage === 'round-result' || snapshot.stage === 'settling') && <><h3>{snapshot.results.at(-1)?.success ? '地狱20层通关 · 正在结算' : snapshot.expedition?.hellFloor ? '地狱挑战失败 · 正在结算' : '本次挑战失败 · 正在结算'}</h3><p>服务器正在保存关卡成果并结算个人收益，请稍候。</p></>}
      </section>
      <div className={s.players}>{snapshot.players.map(player => <div className={s.player} key={player.id}><b>{player.id === snapshot.hostId ? '♜ ' : ''}{player.name}{player.id === profile.id ? '（你）' : ''}</b><span>{!player.connected ? '离线 · 30 秒重连宽限' : snapshot.stage === 'waiting' ? snapshot.players.length === 1 ? '可开启秘境' : player.ready ? '已准备' : '未准备' : player.hp <= 0 ? '灵魂状态' : `生命 ${Math.ceil(player.hp)}/${player.maxHp}`}</span></div>)}</div>{(snapshot.stage === 'waiting' || snapshot.stage === 'final-result' || connection === '重连失败') && <button className={s.ghost} onClick={returnLobby} disabled={busy}>返回游戏大厅</button>}
    </>}
    </main><footer className={s.footer}>v{appVersion} · 客户端战斗 · 规则版本 2</footer></div>;
}

