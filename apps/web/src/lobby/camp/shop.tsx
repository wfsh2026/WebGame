import { useEffect, useRef, useState } from 'react';
import type { ShopStateData } from '@web-game-world/contracts';
import type { LobbyViewProps } from '../../online/lobby-view';
import s from './shop.module.css';

interface ShopProps {
  loadShop: LobbyViewProps['loadShop'];
  purchaseProduct: LobbyViewProps['purchaseProduct'];
  refreshShop: LobbyViewProps['refreshShop'];
  onBusyChange: (busy: boolean) => void;
}

function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const parts = Array.from(bytes, byte => { const hex = byte.toString(16); return hex.padStart(2, '0'); });
  return parts.join('');
}

export function Shop(props: ShopProps) {
  const [state, setState] = useState<ShopStateData | null>(null);
  const [tab, setTab] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const requestIds = useRef<Record<string, string>>({});
  const refreshRequest = useRef<{ revision: number; requestId: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!props.loadShop) return;
    const request = props.loadShop();
    void request.then(current => { if (active) setState(current); }).catch(cause => {
      if (active) { const message = cause instanceof Error ? cause.message : '商店加载失败，请重试'; setError(message); }
    });
    return () => { active = false; };
  }, [props.loadShop]);

  async function reload(): Promise<void> {
    if (!props.loadShop || pending.current) return;
    pending.current = true; setBusy(true); props.onBusyChange(true); setError('');
    try { const current = await props.loadShop(); setState(current); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '商店加载失败，请重试'; setError(message); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  async function refresh(): Promise<void> {
    if (!state || !props.refreshShop || pending.current) return;
    let data = refreshRequest.current;
    if (!data || data.revision !== state.revision) {
      const requestId = newRequestId();
      data = { revision: state.revision, requestId }; refreshRequest.current = data;
    }
    pending.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice('');
    try {
      const current = await props.refreshShop(data);
      setState(current); refreshRequest.current = null; requestIds.current = {};
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '刷新结果暂未确认，请重试或同步货架';
      setError(message);
    } finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  async function purchase(productId: string): Promise<void> {
    if (!state || !props.purchaseProduct || pending.current) return;
    const key = `${state.revision}:${productId}`;
    let requestId = requestIds.current[key];
    if (!requestId) requestId = newRequestId();
    requestIds.current[key] = requestId;
    const data = { productId, requestId, revision: state.revision };
    pending.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice('');
    try {
      const current = await props.purchaseProduct(data);
      setState(current); delete requestIds.current[key];
      setNotice('技能书已生效，可前往技能搭配查看等级与装配。');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '购买结果暂未确认，请刷新商店或重试';
      setError(message);
    } finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  if (!props.loadShop) return <p role="status">请进入账号模式使用商店。</p>;
  if (!state) return <section className={s.shop}><p role="status">{error || '正在加载商店…'}</p>{error && <button onClick={reload} disabled={busy}>重新加载</button>}</section>;
  const activeTab = state.tabs.find(item => item.id === tab) ?? state.tabs[0];
  const products = state.products.filter(item => item.tab === activeTab?.id);
  const panelId = `shop-panel-${activeTab?.id}`;
  const tabId = `shop-tab-${activeTab?.id}`;

  return <section className={s.shop} aria-label="营地商店">
    <div className={s.toolbar}><span>金币 {state.coins} · 素材 {state.materials}</span><button onClick={refresh} disabled={busy || !props.refreshShop || !state.canRefresh || state.coins < state.refreshCoins}>刷新 · {state.refreshCoins} 金币</button></div>
    <div className={s.tabs} role="tablist" aria-label="商品分类">{state.tabs.map(item => {
      const selected = item.id === activeTab?.id;
      const id = `shop-tab-${item.id}`;
      const controls = `shop-panel-${item.id}`;
      function select(): void { setTab(item.id); }
      return <button key={item.id} id={id} role="tab" aria-selected={selected} aria-controls={controls} onClick={select}>{item.name}</button>;
    })}</div>
    <div id={panelId} role="tabpanel" aria-labelledby={tabId} className={s.products}>{products.map(product => {
      const affordable = state.coins >= product.coins && state.materials >= product.materials;
      const label = product.soldOut ? '已售罄' : busy ? '正在处理…' : affordable ? product.currentLevel ? '购买并升级' : '购买并学习' : '金币或素材不足';
      function buy(): void { void purchase(product.id); }
      return <article key={product.id} className={s.product}>
        <h2>{product.name} · Lv{product.level}</h2>
        <p>{product.soldOut ? `当前 Lv${product.currentLevel}` : product.currentLevel ? `当前 Lv${product.currentLevel} → Lv${product.level}` : `学习后 Lv${product.level}`}</p><p>{product.description}</p>
        <div className={s.price}>{product.coins} 金币{product.materials > 0 && ` + ${product.materials} 素材`}</div>
        <button onClick={buy} disabled={busy || product.soldOut || !affordable}>{label}</button>
      </article>;
    })}{products.length === 0 && <p>{state.canRefresh ? '该分类暂无商品。' : '所有技能均已满级。'}</p>}</div>
    {!state.canRefresh && products.length > 0 && <p role="status">所有技能均已满级。</p>}
    {error && <p role="alert">{error}<button onClick={reload} disabled={busy}>同步货架</button></p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
