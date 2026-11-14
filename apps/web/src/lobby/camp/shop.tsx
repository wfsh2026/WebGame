import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { ShopStateData, ShopRefreshData, ShopTabId } from '@web-game-world/contracts';
import type { LobbyViewProps } from '../../online/lobby-view';
import { newRequestId } from '../../network/request-id';
import { ShopProductCard, ShopProductDetails } from './shop-product';
import type { ShopProduct } from './shop-product';
import s from './shop.module.css';

interface ShopProps {
  loadShop: LobbyViewProps['loadShop'];
  purchaseProduct: LobbyViewProps['purchaseProduct'];
  refreshShop: LobbyViewProps['refreshShop'];
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}

function shelfLayout(): { columns: number; rows: number } {
  const width = window.innerWidth; const height = window.innerHeight;
  const columns = width >= 1000 ? 3 : width >= 700 ? 2 : 1;
  return { columns, rows: height < 620 ? 1 : 2 };
}

export function Shop(props: ShopProps) {
  const [state, setState] = useState<ShopStateData | null>(null);
  const [tab, setTab] = useState<ShopTabId>('hearts');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsSync, setNeedsSync] = useState(false);
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState(shelfLayout);
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const pending = useRef(false);
  const requestIds = useRef<Record<string, string>>({});
  const refreshRequests = useRef<Partial<Record<ShopTabId, ShopRefreshData>>>({});
  const tabList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    if (!props.loadShop) return;
    const request = props.loadShop();
    void request.then(current => { if (active) setState(current); }).catch(cause => {
      if (active) { const message = cause instanceof Error ? cause.message : '商店加载失败，请重试'; setError(message); }
    });
    return () => { active = false; };
  }, [props.loadShop]);

  useEffect(() => {
    function resize(): void { const next = shelfLayout(); setLayout(next); setPage(0); }
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    function clearNotice(): void { setNotice(''); }
    const timer = window.setTimeout(clearNotice, 2400);
    return () => { window.clearTimeout(timer); };
  }, [notice]);

  function changeBusy(value: boolean): void { pending.current = value; setBusy(value); props.onBusyChange(value); }
  function selectTab(id: ShopTabId): void { setTab(id); setPage(0); setSelected(null); }
  function closeDetails(): void { setSelected(null); }
  async function reload(): Promise<void> {
    if (!props.loadShop || pending.current) return;
    changeBusy(true); setError('');
    try { const current = await props.loadShop(); setState(current); setNeedsSync(false); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '商店加载失败，请重试'; setError(message); }
    finally { changeBusy(false); }
  }
  async function refresh(): Promise<void> {
    if (!state || !props.refreshShop || pending.current || needsSync) return;
    let data = refreshRequests.current[tab];
    if (!data || data.revision !== state.revision) {
      const requestId = newRequestId();
      data = { tabId: tab, revision: state.revision, requestId }; refreshRequests.current[tab] = data;
    }
    changeBusy(true); setError(''); setNotice(''); setSelected(null);
    try {
      const current = await props.refreshShop(data);
      setState(current); setPage(0); delete refreshRequests.current[tab]; requestIds.current = {};
      setNotice('货架已更新');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '随机结果暂未确认，请同步货架后继续';
      setError(message); setNeedsSync(true);
    } finally { changeBusy(false); }
  }
  async function purchase(productId: string): Promise<void> {
    if (!state || !props.purchaseProduct || pending.current || needsSync) return;
    const key = `${tab}:${state.revision}:${productId}`;
    let requestId = requestIds.current[key];
    if (!requestId) requestId = newRequestId();
    requestIds.current[key] = requestId;
    const data = { tabId: tab, productId, requestId, revision: state.revision };
    changeBusy(true); setError(''); setNotice('');
    try {
      const current = await props.purchaseProduct(data);
      setState(current); delete requestIds.current[key];
      const product = state.products.find(item => item.id === productId);
      setNotice(`${product?.name ?? '物品'}已购买`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '购买结果暂未确认，请同步货架后继续';
      setError(message); setNeedsSync(true);
    } finally { changeBusy(false); }
  }
  function navigateTabs(event: KeyboardEvent<HTMLDivElement>): void {
    if (!state || busy) return;
    const index = state.tabs.findIndex(item => item.id === tab);
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % state.tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index + state.tabs.length - 1) % state.tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = state.tabs.length - 1;
    else return;
    event.preventDefault();
    const next = state.tabs[nextIndex];
    selectTab(next.id);
    const button = tabList.current?.querySelector<HTMLButtonElement>(`#shop-tab-${next.id}`);
    button?.focus();
  }

  const activeTab = state?.tabs.find(item => item.id === tab) ?? state?.tabs[0];
  const products = state?.products.filter(item => item.tab === activeTab?.id) ?? [];
  const columns = products.length === 4 && layout.columns === 3 ? 2 : layout.columns;
  const pageSize = columns * layout.rows;
  const pageCount = Math.ceil(products.length / pageSize);
  const lastPage = Math.max(0, pageCount - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const visible = products.slice(start, start + pageSize);
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  const missingCoins = (activeTab?.refreshCoins ?? 0) - (state?.coins ?? 0);
  const refreshDisabled = busy || needsSync || !props.refreshShop || !activeTab?.canRefresh || missingCoins > 0;
  const refreshDescription = activeTab ? `只更新${activeTab.name}货架，切换分类免费。本类已随机 ${activeTab.refreshCount} 次，下次 ${activeTab.nextRefreshCoins} 金币。${missingCoins > 0 ? `还差 ${missingCoins} 金币。` : ''}` : '';
  function previousPage(): void { setPage(currentPage - 1); }
  function nextPage(): void { setPage(currentPage + 1); }

  return <section className={s.shop} aria-label="营地商店" aria-busy={busy}>
    <header className={s.heading}><h1 id="camp-panel-title">营地商店</h1><div className={s.wallet}><span className={s.coin} aria-hidden="true" /><strong aria-label="金币余额">{state?.coins ?? '—'}</strong>{Boolean(state?.materials) && <small>素材 {state?.materials}</small>}</div><button className={s.close} type="button" onClick={props.onClose} disabled={busy} aria-label="关闭商店">×</button></header>
    {!state ? <div className={s.loading} role="status"><p>{!props.loadShop ? '请进入账号模式使用商店。' : error || '正在加载商店…'}</p>{error && <button className={s.purchase} type="button" onClick={reload} disabled={busy}>重新加载</button>}</div> : <>
      <div className={s.toolbar}>
        <div ref={tabList} className={s.tabs} role="tablist" aria-label="商品分类" onKeyDown={navigateTabs}>{state.tabs.map(item => {
          const selectedTab = item.id === activeTab?.id;
          const id = `shop-tab-${item.id}`; const controls = `shop-panel-${item.id}`;
          function select(): void { selectTab(item.id); }
          return <button type="button" key={item.id} id={id} role="tab" tabIndex={selectedTab ? 0 : -1} aria-selected={selectedTab} aria-controls={controls} onClick={select} disabled={busy}><span className={s.tabMark} data-tab={item.id} aria-hidden="true" />{item.name}</button>;
        })}</div>
        <div className={s.refresh}><button className={s.purchase} type="button" onClick={refresh} disabled={refreshDisabled} title={refreshDescription} aria-label={`随机${activeTab?.name}货架，${activeTab?.refreshCoins} 金币`}><span aria-hidden="true">↻</span> 随机 · {activeTab?.refreshCoins} 金币</button><button type="button" className={s.refreshInfo} aria-label={refreshDescription}>ⓘ</button><p className={s.refreshTip} role="tooltip">{refreshDescription}</p></div>
      </div>
      <div id={`shop-panel-${activeTab?.id}`} role="tabpanel" aria-labelledby={`shop-tab-${activeTab?.id}`} className={s.products} style={gridStyle} tabIndex={0}>{visible.map(product => <ShopProductCard key={product.id} product={product} state={state} busy={busy || needsSync || !props.purchaseProduct} buy={purchase} showDetails={setSelected} />)}{products.length === 0 && <p className={s.empty}>该分类暂无商品</p>}</div>
      {pageCount > 1 && <nav className={s.pagination} aria-label="商品翻页"><button type="button" onClick={previousPage} disabled={busy || currentPage === 0} aria-label="上一页商品">‹</button><span aria-live="polite">{currentPage + 1} / {pageCount}</span><button type="button" onClick={nextPage} disabled={busy || currentPage === lastPage} aria-label="下一页商品">›</button></nav>}
      <div className={s.feedback} aria-live="polite">{error ? <p className={s.error} role="alert">{error}<button type="button" onClick={reload} disabled={busy}>同步货架</button></p> : notice && <p role="status">{notice}</p>}</div>
      {selected && <ShopProductDetails product={selected} state={state} close={closeDetails} />}
    </>}
  </section>;
}
