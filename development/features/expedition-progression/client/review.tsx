import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { BuildStateData, EquipmentLoadoutData, RefreshGrowthData, ExpeditionActionData, ExpeditionDifficultyData, ExpeditionViewData, PersonalReward, RoundResult, Snapshot } from '../../../../packages/contracts/src/index';
import { protocolVersion } from '../../../../packages/contracts/src/index';
import { awardHellGrowth, beginRound, chooseGrowth, changeBuild, discardBuildItem, refreshedGrowthOptions, clearExpeditionCombat, createSimulation, equipmentCatalog, expeditionBaseReward, expeditionCoinMultiplier, expeditionDifficulties, experienceNeeded, initializeBuild, makePlayer, step } from '../../../../packages/simulation/src/index';
import content from '../../../../apps/web/src/network/content';
import { ExpeditionResult } from '../../../../apps/web/src/online/expedition-result';
import { BuildPanel } from '../../../../apps/web/src/online/build-panel';
import { SurvivalOverlay } from '../../../../apps/web/src/online/survival-overlay';
import { Expeditions } from '../../../../apps/web/src/lobby/camp/expeditions';
import s from './review.module.css';

function session(difficulty: ExpeditionDifficultyData) {
  const config = { ...content, difficulty }; const arena = { width: 30, height: 22, spawns: [{ x: 15, y: 11 }], enemySpawns: [{ x: 2, y: 2 }], obstacles: [] };
  const random = Math.random; const options = { config, arena, random }; const sim = createSimulation(options);
  const identity = { id: '00000000-0000-4000-8000-000000000001', name: '功能体验角色' }; const player = makePlayer(identity, config);
  const catalog = equipmentCatalog(config); const ids = catalog.map(item => item.id); const build = { ids, config };
  const setting = expeditionDifficulties[difficulty];
  initializeBuild(player, build); player.coinsEarned = 300 * setting.coins; player.coinsSpent = 0; sim.players.push(player);
  beginRound(sim, 20); const duration = config.waves?.[19]?.interval ?? 95; step(sim, duration);
  const results: RoundResult[] = config.waves.map((wave, index) => ({ round: index + 1, success: true, players: [{ id: player.id, kills: 0, damage: 0, survivalSeconds: wave.interval }] }));
  return { sim, player, results };
}

export default function ExpeditionProgressionReview() {
  const [difficulty, setDifficulty] = useState<ExpeditionDifficultyData>('normal');
  const live = useRef<ReturnType<typeof session> | null>(null);
  if (!live.current) live.current = session(difficulty);
  const [, render] = useState(0);
  const [continued, setContinued] = useState(false); const [gifts, setGifts] = useState(0);
  const [reward, setReward] = useState<PersonalReward>(); const query = new URLSearchParams(location.search); const initialSelector = query.get('case') === 'selector';
  const [selector, setSelector] = useState(initialSelector); const [error, setError] = useState('');
  const { sim, player } = live.current; const floor = Math.max(0, sim.round - 20);
  const expedition: ExpeditionViewData = { difficulty, stages: 20, hellStages: 20, hellFloor: floor, baseCleared: true, decision: Boolean(sim.preparing) && sim.round < 40, saving: false, continuedIds: continued ? [player.id] : [], gifts: { [player.id]: gifts } };
  const results = live.current.results;
  const completedSeconds = results.reduce((total, result) => total + (result.players[0]?.survivalSeconds ?? 0), 0);
  const preparation = sim.preparing ? { readyIds: [], participantIds: [player.id], countdown: 0, startedAt: 0, reminded: false } : undefined;
  const snapshot: Snapshot = { preparation, protocol: protocolVersion, roomId: 'local-effect-page', hostId: player.id, stage: 'combat', round: sim.round, seconds: Math.max(0, 60 - sim.elapsed), width: 30, height: 22, players: [player], enemies: [], projectiles: [], effects: [], results, error: '', serverTime: 0, resting: Boolean(sim.preparing), expedition };
  const required = experienceNeeded(player.level);
  const state: BuildStateData = { characterLevel: player.characterLevel ?? 1, coinsEarned: player.coinsEarned ?? 0, coinsSpent: player.coinsSpent ?? 0, characterRanks: player.characterRanks, revision: player.buildRevision, level: player.level, experience: player.experience, required, upgradeCredits: player.upgradeCredits, waveCredits: player.waveCredits, items: player.buildItems, loadout: player.loadout, choices: player.choices };
  function update(): void { render(value => value + 1); }
  function reset(value: ExpeditionDifficultyData): void { live.current = session(value); setDifficulty(value); setReward(undefined); setContinued(false); setGifts(0); setError(''); update(); }
  function changeDifficulty(event: ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value; if (value === 'normal' || value === 'hard' || value === 'nightmare') reset(value);
  }
  function settle(failed: boolean): void {
    const earned = player.coinsEarned ?? 0; const spent = player.coinsSpent ?? 0; const pending = Math.max(0, earned - spent); const coins = failed ? 0 : pending; const completedFloor = Math.max(0, sim.round - 20);
    setReward({ id: player.id, coins, materials: 0, earned, spent, outcome: failed ? 'failed' : sim.round === 40 ? 'hell-victory' : 'extracted', baseCleared: true, hellFloor: failed ? Math.max(0, completedFloor - 1) : completedFloor, lost: failed ? pending : 0 });
  }
  function choose(data: ExpeditionActionData): void {
    if (data.action === 'extract') { settle(false); return; }
    if (sim.round === 20) { setGifts(5); awardHellGrowth(sim, player); }
    setContinued(true); update();
  }
  function chooseReward(id: number, index: number, targetId?: string): void {
    const request = { choiceId: id, index, targetId }; const issue = chooseGrowth(sim, player, request); setError(issue);
    if (issue) return;
    const remaining = gifts - 1; setGifts(remaining); if (remaining > 0) awardHellGrowth(sim, player); update();
  }
  function start(): void { beginRound(sim, sim.round + 1); setContinued(false); update(); }
  function finish(): void {
    step(sim, 60); const base = expeditionBaseReward(sim.round); const multiplier = expeditionCoinMultiplier(sim.config, sim.round);
    player.coinsEarned = (player.coinsEarned ?? 0) + base * multiplier;
    const record: RoundResult = { round: sim.round, success: true, players: [{ id: player.id, kills: 0, damage: 0, survivalSeconds: sim.elapsed }] };
    if (live.current) live.current.results.push(record);
    clearExpeditionCombat(sim); setContinued(false);
    if (sim.round === 40) settle(false); update();
  }
  function milestone(): void { for (let round = sim.round + 1; round <= 25; round += 1) { beginRound(sim, round); finish(); } }
  function finalLayer(): void { for (let round = sim.round + 1; round <= 40; round += 1) { beginRound(sim, round); finish(); } }
  function fail(): void { if (sim.preparing) beginRound(sim, sim.round + 1); player.hp = 0; step(sim, .02);
    const record: RoundResult = { round: sim.round, success: false, players: [{ id: player.id, kills: 0, damage: 0, survivalSeconds: sim.elapsed }] };
    if (live.current) live.current.results.push(record); settle(true); }
  function closeResult(): Promise<void> { reset(difficulty); return Promise.resolve(); }
  async function createRoom(_id?: string, value?: ExpeditionDifficultyData): Promise<void> { reset(value ?? difficulty); setSelector(false); }
  function closeSelector(): void { setSelector(false); }
  function refresh(data: RefreshGrowthData): void {
    const choice = player.choices.find(entry => entry.id === data.choiceId); if (!choice) return;
    const available = (player.coinsEarned ?? 0) - (player.coinsSpent ?? 0);
    if (available < 8) { setError('本局金币不足'); return; }
    const options = refreshedGrowthOptions(sim, player, choice); choice.options = options;
    choice.refreshCount = (choice.refreshCount ?? 0) + 1; player.coinsSpent = (player.coinsSpent ?? 0) + 8; player.buildRevision += 1; update();
  }
  function equip(loadout: EquipmentLoadoutData, revision: number): void { const request = { loadout, revision }; const issue = changeBuild(player, request, sim.config); setError(issue); update(); }
  function discard(id: string): void { const issue = discardBuildItem(player, id); setError(issue); update(); }
  function waveReady(value: boolean): void { if (value && gifts === 0 && continued) start(); }
  function remind(): void {}
  const coins = Math.max(0, (player.coinsEarned ?? 0) - (player.coinsSpent ?? 0));
  return <main className={s.page}><header><h1>20关与地狱续战 · 功能效果</h1><p>复用实际难度选择、计时清场、成长、风险提示和结算组件；本地隔离数据，不连接账号资产。</p></header>
    <nav className={s.controls}><label>难度<select value={difficulty} onChange={changeDifficulty}><option value="normal">普通</option><option value="hard">困难</option><option value="nightmare">噩梦</option></select></label><button onClick={() => reset(difficulty)}>重置基础通关</button><button onClick={() => setSelector(true)}>查看秘境选择</button><button onClick={milestone}>进入第5层结算</button><button onClick={finalLayer}>第20层胜利</button><button onClick={fail}>地狱失败效果</button></nav>
    {selector ? <section className={s.selector}><Expeditions unlockedDifficulties={['normal', 'hard', 'nightmare']} rooms={[]} busy={false} error="" enterRoom={createRoom} onClose={closeSelector} /></section> : reward ? <ExpeditionResult expedition={expedition} playerId={player.id} name={player.name} results={results} reward={reward} busy={false} error={error} onClose={closeResult} /> : <>
      <section className={s.stage}><h2>{expeditionDifficulties[difficulty].name} · {floor ? `地狱${floor}层` : '基础20关通关'}</h2><p>待提取 {coins} 金币 · 局内生命上限 {player.maxHp} · 灵力上限 {player.capacity}</p>
      {continued && gifts === 0 && <button onClick={start}>准备，开始下一层</button>}{!sim.preparing && <button onClick={finish}>推进本层60秒，查看计时清场</button>}
</section>
      <BuildPanel connected snapshot={snapshot} waveReady={waveReady} remind={remind} resting={Boolean(sim.preparing)} loot={{ revision: 0, safe: [], consumables: [] }} player={player} discard={discard} state={state} error={error} refresh={refresh} choose={chooseReward} equip={equip} decide={choose} />
      <SurvivalOverlay preparation={preparation} expedition={expedition} coins={coins} enemies={sim.enemies.length} warnings={[]} pending={sim.waveQueue.length} round={sim.round} seconds={snapshot.seconds} survived={completedSeconds + (sim.preparing ? 0 : sim.elapsed)} resting={Boolean(sim.preparing)} living={player.hp > 0 ? 1 : 0} total={1} />
    </>}
  </main>;
}
