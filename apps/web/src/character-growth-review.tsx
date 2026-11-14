import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CharacterGrowthSaveData, CharacterUpgradeData, Profile } from '@web-game-world/contracts';
import { characterUpgradePrice, defaultCharacterPoints, emptyCharacterGrowth } from '@web-game-world/simulation';
import { CharacterUpgrade } from './lobby/camp/character-upgrade';
import background from '../../../content/common/lobby/camp-background-shop-ground.webp';
import camp from './lobby/camp/camp.module.css';

const query = new URLSearchParams(window.location.search);
const level = Number(query.get('level') ?? 7);
const coins = Number(query.get('coins') ?? 760);
const name = query.get('name') ?? '林间旅人';
const growth = level >= 4 ? { ...emptyCharacterGrowth, power: 2, vitality: 1 } : { ...emptyCharacterGrowth };
const talents = query.has('talents') ? ['brute', 'healthy'] : [];
const points = { ...defaultCharacterPoints, power: talents.length ? 2 : defaultCharacterPoints.power };
const character = { name, description: '', points, talents };
const initialProfile: Profile = { id: '00000000-0000-4000-8000-000000000001', name, role: null, coins, materials: 0, character, characterLevel: level, characterGrowth: growth, characterGrowthRevision: 0 };

function delay(): Promise<void> {
  const pending = new Promise<void>(resolve => { window.setTimeout(resolve, 250); });
  return pending;
}

function Review() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close(): void { if (!busy) dialog.current?.close(); }
  async function upgrade(data: CharacterUpgradeData): Promise<Profile> {
    await delay();
    if (query.has('fail')) throw new Error('升级暂未完成，请重试');
    const currentLevel = profile.characterLevel ?? 1;
    const price = characterUpgradePrice(currentLevel);
    if (data.level !== currentLevel || currentLevel >= 20 || profile.coins < price) throw new Error('当前无法升级');
    const next = { ...profile, coins: profile.coins - price, characterLevel: currentLevel + 1 };
    setProfile(next);
    return next;
  }
  async function saveGrowth(data: CharacterGrowthSaveData): Promise<Profile> {
    await delay();
    if (query.has('fail')) throw new Error('分配暂未保存，请重试');
    if (data.revision !== profile.characterGrowthRevision) throw new Error('成长状态已更新，请重新分配');
    const next = { ...profile, characterGrowth: { ...data.points }, characterGrowthRevision: data.revision + 1 };
    setProfile(next);
    return next;
  }
  const style = { position: 'fixed' as const, inset: 0, background: `url(${background}) center / cover no-repeat` };
  return <main className={camp.root}><div style={style} /><dialog ref={dialog} className={`${camp.dialog} ${camp.characterDialog}`} aria-labelledby="camp-panel-title" onCancel={event => { event.preventDefault(); close(); }}><section className={`${camp.panel} ${camp.characterPanel}`}><div className={`${camp.panelBody} ${camp.characterBody}`}><CharacterUpgrade profile={profile} upgrade={upgrade} saveGrowth={saveGrowth} onBusyChange={setBusy} onClose={close} /></div></section></dialog></main>;
}
const container = document.getElementById('root');
if (container) { const root = createRoot(container); root.render(<Review />); }
