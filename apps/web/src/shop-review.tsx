import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { equipmentCatalog } from '@web-game-world/simulation';
import type { ShopPurchaseData, ShopRefreshData, ShopStateData, ShopTabId } from '@web-game-world/contracts';
import { Shop } from './lobby/camp/shop';
import manifest from './network/content';
import background from '../../../content/common/lobby/camp-background-shop-ground.webp';
import camp from './lobby/camp/camp.module.css';
import { SkillReview } from './skill-review';

const catalog = equipmentCatalog(manifest);
const query = new URLSearchParams(window.location.search);
const batch = Number(query.get('batch') ?? 0);
const ids = ['heart/stream', 'heart/spring', 'heart/ocean', 'heart/cycle', 'skill/fireball', 'skill/flying-blade', 'skill/frost', 'skill/chain-lightning', 'skill/sword-array', 'skill/binding-trap', 'support/economy', 'support/overload', 'support/haste', 'support/area', 'support/duration', 'support/homing'];
const referenceIds = ids.map(id => `forest-survival:${id}`);
const selectedIds = batch === 0 ? referenceIds : ['heart', 'skill', 'support'].flatMap(kind => {
  const pool = catalog.filter(item => item.kind === kind && !referenceIds.includes(item.id));
  const start = (batch - 1) * 6; const page = pool.slice(start, start + 6);
  return page.map(item => item.id);
});
const products: ShopStateData['products'] = selectedIds.map(definitionId => {
  const item = catalog.find(item => item.id === definitionId);
  if (!item) throw new Error(`缺少对照商品：${definitionId}`);
  const tab: ShopTabId = item.kind === 'heart' ? 'hearts' : item.kind === 'skill' ? 'skills' : 'supports';
  return { id: item.id, name: item.name, description: item.description ?? '', tab, level: 1, currentLevel: 0, coins: 60, materials: 0, soldOut: false, recommended: false };
});
const tabs: ShopStateData['tabs'] = [
  { id: 'hearts', name: '心法', refreshCount: 0, refreshCoins: 10, nextRefreshCoins: 15, canRefresh: true, acquired: true },
  { id: 'skills', name: '技能', refreshCount: 0, refreshCoins: 10, nextRefreshCoins: 15, canRefresh: true, acquired: true },
  { id: 'supports', name: '辅助宝石', refreshCount: 0, refreshCoins: 10, nextRefreshCoins: 15, canRefresh: true, acquired: true }
];
const initialCoins = Number(query.get('coins') ?? 230);
const initialState: ShopStateData = { products, tabs, coins: initialCoins, materials: 0, revision: 1, characterLevel: 1, ownedDefinitionIds: ['forest-survival:heart/stream', 'forest-survival:skill/longblade', 'forest-survival:support/economy'], onboarding: { completed: true, compatible: true, totalCoins: 180, remainingCoins: 0 } };
let state = initialState;
async function loadShop(): Promise<ShopStateData> { return state; }
async function purchaseProduct(data: ShopPurchaseData): Promise<ShopStateData> {
  if (data.revision !== state.revision) throw new Error('货架版本不一致');
  const product = state.products.find(item => item.id === data.productId && item.tab === data.tabId);
  if (!product || product.soldOut || product.coins > state.coins) throw new Error('当前无法购买');
  const products = state.products.map(item => item === product ? { ...item, soldOut: true, currentLevel: 1 } : item);
  const ownedDefinitionIds = [...state.ownedDefinitionIds, product.id];
  state = { ...state, products, ownedDefinitionIds, coins: state.coins - product.coins };
  return state;
}
async function refreshShop(data: ShopRefreshData): Promise<ShopStateData> {
  const tab = state.tabs.find(item => item.id === data.tabId);
  if (!tab || tab.refreshCoins > state.coins) throw new Error('金币不足');
  const tabs = state.tabs.map(item => item === tab ? { ...item, refreshCount: item.refreshCount + 1, refreshCoins: item.nextRefreshCoins, nextRefreshCoins: item.nextRefreshCoins + 5 } : item);
  const products = state.products.map(item => item.tab === tab.id ? { ...item, soldOut: false } : item);
  state = { ...state, tabs, products, coins: state.coins - tab.refreshCoins, revision: state.revision + 1 };
  return state;
}
function Review() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function close(): void { if (!busy) dialog.current?.close(); }
  const style = { position: 'fixed' as const, inset: 0, background: `url(${background}) center / cover no-repeat` };
  return <main className={camp.root}><div style={style} /><dialog ref={dialog} className={`${camp.dialog} ${camp.shopDialog}`} aria-labelledby="camp-panel-title" onCancel={close}><section className={`${camp.panel} ${camp.shopPanel}`}><div className={camp.panelBody}><Shop loadShop={loadShop} purchaseProduct={purchaseProduct} refreshShop={refreshShop} onBusyChange={setBusy} onClose={close} /></div></section></dialog></main>;
}
const container = document.getElementById('root');
if (container) { const root = createRoot(container); const screen = query.get('view') === 'skills' ? <SkillReview /> : <Review />; root.render(screen); }
