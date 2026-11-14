import { useEffect, useRef } from 'react';
import type { MouseEvent, SyntheticEvent } from 'react';
import type { ShopStateData } from '@web-game-world/contracts';
import { equipmentCatalog, equipmentKindName, supportCompatible } from '@web-game-world/simulation';
import type { EquipmentItem } from '@web-game-world/simulation';
import { ShopIcon } from './shop-icon';
import { displayNumber, equipmentDescription } from '../../hud/display-number';
import manifest from '../../network/content';
import s from './shop.module.css';

export type ShopProduct = ShopStateData['products'][number];
const catalog = equipmentCatalog(manifest);
const highlights: Record<string, string> = {
  slash: '扇形横扫 · 近战清群', dual: '快速双刃 · 单体连击', spear: '直线穿刺 · 贯穿敌群', hammer: '扇形重击 · 击退敌人',
  blade: '直线风刃 · 穿透攻击', star: '追踪目标 · 高频攻击', fireball: '命中爆炸 · 范围伤害', frost: '冰棘命中 · 减速控制',
  'thunder-staff': '横扫敌群 · 引爆雷印', 'thunder-seal': '附加雷印 · 配合引爆', 'star-beam': '持续灵束 · 穿透攻击',
  'chain-lightning': '雷电连锁 · 多目标伤害', 'decay-curse': '持续侵蚀 · 诅咒伤害', 'sword-array': '远处布阵 · 持续攻击', 'binding-trap': '接敌触发 · 陷阱减速',
  'banner-power': '提高伤害 · 军威冲击', 'banner-tempo': '缩短间隔 · 锋芒攻击', 'banner-wind': '加快动作 · 穿阵风刃',
  'banner-energy': '强化回灵 · 灵潮攻击', 'banner-guard': '范围减伤 · 地脉震击',
  economy: '降低耗能 · 略减效果', overload: '强化效果 · 增加耗能', haste: '缩短间隔 · 加快出手', area: '扩大范围 · 略减效果',
  multiple: '扇形多弹 · 单弹减伤', knockback: '近战击退 · 首领免疫', resonance: '异类攻击 · 共鸣强化', fork: '首次命中 · 分裂小弹',
  unleash: '累计施放 · 追加延迟弹', aftershock: '命中后追加余震', 'execution-spread': '直接击杀 · 传播状态',
  duration: '延长战旗持续时间', linger: '离阵后保留战旗增益', twin: '同种战旗可保留两面', concentrate: '缩小范围 · 强化效果', homing: '投射物追踪附近敌人'
};

function highlight(item: EquipmentItem): string {
  if (item.kind === 'heart') {
    if (item.effect === 'cycle') return '近远交替 · 额外回灵';
    const capacity = displayNumber(item.capacity);
    return `灵力池 ${capacity}`;
  }
  const text = highlights[item.effect ?? ''];
  const description = item.description ?? '';
  if (item.effect === 'frost') {
    const slow = description.match(/^减速(.+?)持续([^；。]+)/);
    if (slow) return `减速${slow[1]} · 持续${slow[2]}`;
  }
  if (item.effect === 'chain-lightning') {
    const targets = description.match(/连锁(\d+)个目标/);
    if (targets) return `连锁${targets[1]}目标 · 逐跳衰减`;
  }
  if (item.effect === 'blade') {
    const targets = description.match(/命中(\d+)个目标/);
    if (targets) return `穿透攻击 · 命中${targets[1]}目标`;
  }
  if (text) return text;
  const clauses = description.split(/[；。]/);
  return clauses[0] || (item.kind === 'support' ? '改变所属技能效果' : '自动攻击');
}

function parameters(item: EquipmentItem, compact = false): string {
  if (item.kind === 'heart') {
    const recovery = displayNumber(item.recovery); const interval = displayNumber(item.interval);
    return `每 ${interval} 秒恢复 ${recovery} 灵力`;
  }
  if (item.kind === 'support') {
    const cost = displayNumber(item.costMultiplier); const damage = displayNumber(item.damageMultiplier);
    const description = equipmentDescription(item);
    const sentences = description.split('。'); const parts = sentences[0].split(' · ');
    const brief = parts[2]?.replace(/^(战旗|追加)/, '');
    const benefit = brief?.replace(/^共鸣增幅/, '共鸣');
    if (compact && benefit) return `${benefit} · 耗能 ×${cost}`;
    return `耗能 ×${cost} · 效果 ×${damage}`;
  }
  const roundedCost = Math.round(item.cost * 10) / 10;
  const cost = displayNumber(compact ? roundedCost : item.cost); const interval = displayNumber(item.interval);
  return `灵力 ${cost} · 间隔 ${interval}秒`;
}

function compatibleSkills(item: EquipmentItem, state: ShopStateData): EquipmentItem[] {
  if (item.kind !== 'support') return [];
  return catalog.filter(ability => {
    const owned = state.ownedDefinitionIds.includes(ability.id);
    return ability.kind === 'skill' && owned && supportCompatible(item, ability);
  });
}

interface CardProps {
  product: ShopProduct;
  state: ShopStateData;
  busy: boolean;
  buy: (id: string) => Promise<void>;
  showDetails: (product: ShopProduct) => void;
}

export function ShopProductCard(props: CardProps) {
  const { product, state, busy } = props;
  const item = catalog.find(entry => entry.id === product.id);
  if (!item) return null;
  const missingCoins = product.coins - state.coins;
  const affordable = missingCoins <= 0 && state.materials >= product.materials;
  const label = product.soldOut ? '已购买' : missingCoins > 0 ? '金币不足' : !affordable ? '素材不足' : '购买';
  const reason = missingCoins > 0 ? `还差 ${missingCoins} 金币` : !affordable ? '素材不足' : `购买${product.name}`;
  const effect = highlight(item); const stats = parameters(item, true);
  const compatible = compatibleSkills(item, state);
  const unmatched = item.kind === 'support' && compatible.length === 0;
  const detailLabel = `查看${product.name}详情`;
  function buy(): void { void props.buy(product.id); }
  function showDetails(): void { props.showDetails(product); }
  return <article className={s.product} data-sold={product.soldOut}>
    <div className={s.productInfo}>
      <div className={s.art}><ShopIcon item={item} /></div>
      <div className={s.itemHeading}><button type="button" className={s.name} onClick={showDetails} aria-label={detailLabel}>{product.name}<span className={s.info} aria-hidden="true">ⓘ</span></button><small title={product.currentLevel > 0 ? '已拥有同种物品，可另购一件' : undefined}>Lv.{product.level}</small></div>
      <p className={s.effect} title={effect}>{effect}</p>
      <p className={s.parameters}>{stats}</p>
    </div>
    <div className={s.purchaseRow}><span className={s.price}><span className={s.coin} aria-hidden="true" /><strong aria-label={`${product.coins} 金币`}>{product.coins}</strong>{product.materials > 0 && <small>＋{product.materials} 素材</small>}{unmatched && <small className={s.unmatched} title="暂无兼容的已拥有技能，点击商品名称查看适用范围">未匹配</small>}</span><button className={s.purchase} type="button" onClick={buy} disabled={busy || product.soldOut || !affordable} title={reason}>{label}</button></div>
  </article>;
}

interface DetailsProps { product: ShopProduct; state: ShopStateData; close: () => void }

export function ShopProductDetails(props: DetailsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const item = catalog.find(entry => entry.id === props.product.id);
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    return () => { current?.close(); };
  }, []);
  if (!item) return null;
  const kind = equipmentKindName(item);
  const stats = parameters(item);
  const fullDescription = equipmentDescription(item);
  const clauses = fullDescription.split('；');
  const description = item.kind === 'heart' && item.effect !== 'cycle' ? clauses[0] : fullDescription;
  const compatible = compatibleSkills(item, props.state);
  const names = compatible.map(ability => ability.name);
  const compatibleText = names.join('、');
  const host = item.host === 'melee' ? '近战技能' : item.host === 'ranged' ? '远程技能' : '近战与远程技能';
  const slots = item.kind === 'heart' ? `${item.slots} 个技能槽` : `${item.supportSlots} 个辅助槽`;
  const capacity = displayNumber(item.capacity);
  const range = displayNumber(item.range ?? 0);
  function close(): void { dialog.current?.close(); props.close(); }
  function cancel(event: SyntheticEvent<HTMLDialogElement>): void { event.preventDefault(); event.stopPropagation(); close(); }
  function backdrop(event: MouseEvent<HTMLDialogElement>): void { event.stopPropagation(); if (event.target === event.currentTarget) close(); }
  return <dialog ref={dialog} className={s.detailDialog} aria-labelledby="shop-detail-title" onCancel={cancel} onClick={backdrop}>
    <header className={s.detailHeader}><ShopIcon item={item} size={68} /><div><small>{kind} · Lv.{props.product.level}</small><h2 id="shop-detail-title">{props.product.name}</h2></div><button type="button" className={s.close} onClick={close} aria-label="关闭商品详情">×</button></header>
    <div className={s.detailBody}>
      <p className={s.detailStats}>{stats}</p>
      {item.kind === 'heart' && <p>灵力池 {capacity} · 初始激活 {slots}</p>}
      {item.kind === 'skill' && <p>初始激活 {slots} · 射程 {range} 米</p>}
      {item.kind === 'support' && <><p>适用：{host}{item.requiresProjectile ? '中的投射物技能' : ''}</p><p className={compatible.length ? s.compatible : s.incompatible}>{compatible.length ? `已拥有的兼容技能：${compatibleText}` : '暂无兼容的已拥有技能'}</p></>}
      {description && <p>{description}</p>}
      {props.product.currentLevel > 0 && <p className={s.detailNote}>已拥有同种物品，本次购买会新增一件。</p>}
    </div>
  </dialog>;
}
