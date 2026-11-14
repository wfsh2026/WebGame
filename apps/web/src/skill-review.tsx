import { useEffect, useRef, useState } from 'react';
import { buildCatalog, characterSlots, equipmentCatalog, equipmentError, starterEquipmentIds, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentLoadoutData, EquipmentStateData } from '@web-game-world/contracts';
import { SkillConstellation } from './lobby/camp/skill-constellation';
import manifest from './network/content';
import background from '../../../content/common/lobby/camp-background-shop-ground.webp';
import camp from './lobby/camp/camp.module.css';

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'default';
const characterLevel = scenario === 'full' ? 20 : scenario === 'starter' ? 1 : 8;
const capacity = characterSlots(characterLevel);
const definitions = equipmentCatalog(manifest);
const items = definitions.map(item => {
  const level = scenario === 'full' ? 20 : item.id.endsWith('heart/stream') || item.id.endsWith('skill/fireball') ? 5 : 1;
  return { id: `review:${item.id}`, definitionId: item.id, level, bonus: 0, experience: 0 };
});
const starters = starterEquipmentIds.map((definitionId, index) => ({ id: `starter:${index}`, definitionId, level: 1, bonus: 0, experience: 0 }));
items.push(...starters);
function id(path: string): string { return `review:forest-survival:${path}`; }
function branch(path: string, support?: string) {
  const supports = Array.from({ length: capacity.supports }, (_, index) => index === 0 && support ? id(support) : null);
  const itemId = id(path);
  return { itemId, supports };
}
const slots: EquipmentLoadoutData['slots'] = Array.from({ length: capacity.abilities }, () => null);
if (scenario !== 'empty') {
  slots[0] = branch('skill/fireball', 'support/economy');
  if (capacity.abilities > 1) slots[1] = branch('skill/flying-blade');
  if (capacity.abilities > 2) slots[2] = branch('skill/frost');
  if (scenario === 'full') {
    slots[3] = branch('skill/longblade'); slots[4] = branch('skill/banner-power');
    for (const [index, slot] of slots.entries()) {
      if (!slot) continue;
      const catalog = buildCatalog(manifest, items);
      const ability = catalog.find(item => item.id === slot.itemId);
      const compatible = definitions.filter(item => item.kind === 'support' && ability && supportCompatible(item, ability));
      const selected = compatible.slice(0, capacity.supports);
      slot.supports = selected.map(support => {
        const instance = { id: `review:gem-${index}-${support.id}`, definitionId: support.id, level: 20, bonus: 0, experience: 0 };
        items.push(instance);
        return instance.id;
      });
    }
  }
}
const heart = scenario === 'empty' ? null : id('heart/stream');
const loadout: EquipmentLoadoutData = { heart, slots };
const previousLoadout: EquipmentLoadoutData = { heart: 'forest-survival:heart/stream', slots: [{ itemId: 'forest-survival:skill/fireball', supports: ['forest-survival:support/economy'] }] };
let state: EquipmentStateData = { characterLevel, coins: scenario === 'poor' ? 20 : 500, previousLoadout, copyBaseCoins: 180, copyCoins: 270, copyError: '', loadout, ownedIds: items.map(item => item.id), items, revision: 1 };
async function loadEquipment(): Promise<EquipmentStateData> {
  if (scenario === 'load-error') throw new Error('本地对照：装配读取失败');
  return state;
}
async function saveEquipment(data: { loadout: EquipmentLoadoutData; revision: number }): Promise<EquipmentStateData> {
  if (scenario === 'save-error') throw new Error('本地对照：装配版本已更新，请刷新');
  if (data.revision !== state.revision) throw new Error('装配版本不一致');
  const catalog = buildCatalog(manifest, state.items);
  const context = { catalog, ownedIds: state.ownedIds, characterLevel: state.characterLevel };
  const error = equipmentError(data.loadout, context);
  if (error) throw new Error(error);
  state = { ...state, loadout: data.loadout, revision: state.revision + 1 };
  return state;
}
async function copyEquipment(data: { requestId: string; revision: number; coins: number }): Promise<EquipmentStateData> {
  if (data.revision !== state.revision || data.coins !== state.copyCoins || state.coins < data.coins) throw new Error('复制条件已变化');
  const first = branch('skill/fireball', 'support/economy');
  const slots = Array.from({ length: capacity.abilities }, (_, index) => index === 0 ? first : null);
  const loadout = { heart: id('heart/stream'), slots };
  state = { ...state, loadout, revision: state.revision + 1, coins: state.coins - data.coins };
  return state;
}
export function SkillReview() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close(): void { if (!busy) dialog.current?.close(); }
  const style = { position: 'fixed' as const, inset: 0, background: `url(${background}) center / cover no-repeat` };
  return <main className={camp.root}><div style={style} /><dialog ref={dialog} className={`${camp.dialog} ${camp.skillDialog}`} aria-labelledby="camp-panel-title" onCancel={event => { event.preventDefault(); close(); }}><section className={`${camp.panel} ${camp.skillPanel}`}><div className={`${camp.panelBody} ${camp.skillBody}`}><SkillConstellation loadEquipment={loadEquipment} saveEquipment={saveEquipment} copyEquipment={copyEquipment} attackSpeed={1} castingSpeed={1} energyCapacityBonus={0} onBusyChange={setBusy} onClose={close} /></div></section></dialog></main>;
}
