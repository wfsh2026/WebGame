import { useEffect, useRef, useState } from 'react';
import type { InventoryCategory, InventoryItemData } from '@web-game-world/contracts';
import type { BackpackViewProps } from '../../online/lobby-view';
import s from './backpack.module.css';

const categories: { id: InventoryCategory; label: string }[] = [{ id: 'skill', label: '技能' }, { id: 'equipment', label: '装备' }, { id: 'material', label: '材料' }];
const names = { skill: '技能', equipment: '装备', material: '材料' };
const orders = [{ id: 'latest', label: '最新' }, { id: 'name', label: '名称' }, { id: 'quantity', label: '数量' }];

const iconPositions: Record<string, string> = {
  'test-inventory:skill/wind': '50% 0%', 'test-inventory:skill/frost': '100% 0%',
  'test-inventory:equipment/bow': '0% 50%', 'test-inventory:equipment/armor': '50% 50%', 'test-inventory:equipment/dagger': '100% 50%',
  'test-inventory:material/herb': '0% 100%', 'test-inventory:material/ore': '50% 100%', 'test-inventory:material/wood': '100% 100%'
};
function ItemIcon(props: { category?: InventoryCategory; definitionId?: string }) {
  const defaults = { skill: '50% 0%', equipment: '0% 50%', material: '50% 100%' };
  const position = props.definitionId ? iconPositions[props.definitionId] : undefined;
  const backgroundPosition = position ?? (props.category ? defaults[props.category] : '0% 0%');
  const style = { backgroundPosition };
  return <span className={s.icon} style={style} aria-hidden="true" />;
}

export function Backpack(props: BackpackViewProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<InventoryCategory>('skill');
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('latest');
  const [items, setItems] = useState<InventoryItemData[]>([]);
  const [selected, setSelected] = useState<InventoryItemData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const battle = props.mode === 'battle';

  function close(): void { setSelected(null); setOpen(false); props.onOpenChange?.(false); }
  function toggle(): void {
    if (open) { close(); return; }
    if (props.disabled) return;
    setOpen(true); props.onOpenChange?.(true);
  }
  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    if (open) current.showModal();
    else if (current.open) { current.close(); trigger.current?.focus(); }
  }, [open]);
  useEffect(() => {
    const current = detail.current;
    if (!current) return;
    if (selected) current.showModal();
    else if (current.open) { current.close(); selectedButton.current?.focus(); }
  }, [selected]);
  useEffect(() => {
    function keyDown(event: KeyboardEvent): void {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      if (event.code !== 'KeyB' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (props.disabled) return;
      event.preventDefault(); event.stopPropagation(); toggle();
    }
    window.addEventListener('keydown', keyDown, true);
    return () => window.removeEventListener('keydown', keyDown, true);
  }, [open, props.disabled, props.onOpenChange]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(''); setItems([]);
    async function load(): Promise<void> {
      try {
        const result = await props.loadInventory();
        if (active) setItems(result);
      } catch {
        if (active) setError('背包加载失败，请重试');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [open, reload, props.loadInventory]);

  const search = query.trim().toLocaleLowerCase();
  const filtered = items.filter(item => {
    const name = item.name.toLocaleLowerCase();
    return item.category === category && name.includes(search);
  });
  filtered.sort((left, right) => {
    if (order === 'name') return left.name.localeCompare(right.name, 'zh-CN');
    if (order === 'quantity') return right.quantity - left.quantity || left.name.localeCompare(right.name, 'zh-CN');
    return right.acquiredAt.localeCompare(left.acquiredAt) || left.id.localeCompare(right.id);
  });
  const dialogClass = `${s.window} ${battle ? s.battle : ''}`;
  const triggerClass = `${s.trigger} ${battle ? s.battleTrigger : ''}`;
  return <>
    <button ref={trigger} className={triggerClass} disabled={props.disabled} onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-label="打开背包（B）"><ItemIcon /><span>背包</span><kbd>B</kbd></button>
    <dialog ref={dialog} className={dialogClass} aria-labelledby={`backpack-title-${props.mode}`} onCancel={event => { event.preventDefault(); close(); }}>
      <header className={s.header}><span>◇</span><h2 id={`backpack-title-${props.mode}`}>背 包</h2><button className={s.close} aria-label="关闭背包" onClick={close}>×</button></header>
      {battle && <p className={s.warning}>战斗进行中 · 打开背包不会暂停</p>}
      <nav className={s.tabs} aria-label="物品分类">{categories.map(tab => <button key={tab.id} aria-pressed={category === tab.id} onClick={() => setCategory(tab.id)}>{tab.label}</button>)}</nav>
      <div className={s.tools}><input aria-label="搜索物品" placeholder="搜索物品" value={query} maxLength={24} onChange={event => setQuery(event.target.value)} /><div className={s.sort} aria-label="物品排序">{orders.map(option => <button key={option.id} aria-pressed={order === option.id} onClick={() => setOrder(option.id)}>{option.label}</button>)}</div></div>
      <div className={s.contents} aria-busy={loading}>
        {loading ? <p className={s.empty} role="status">正在打开行囊…</p> : error ? <div className={s.empty} role="alert"><p>{error}</p><button onClick={() => setReload(reload + 1)}>重新加载</button></div> : filtered.length === 0 ? <div className={s.empty}><ItemIcon category={category} /><p>{search ? '没有找到匹配的物品' : `暂无${names[category]}物品`}</p></div> : <div className={s.grid}>{filtered.map(item => <button className={s.item} key={item.id} onClick={event => { selectedButton.current = event.currentTarget; setSelected(item); }} aria-haspopup="dialog"><ItemIcon category={item.category} definitionId={item.definitionId} /><b>{item.name} · Lv.{item.level}</b><span>数量：{item.quantity}</span></button>)}</div>}
      </div>
      <footer className={s.footer}><span>点击物品查看详情</span><span>B 背包 · Esc 关闭</span></footer>
    </dialog>
    <dialog ref={detail} className={s.detail} aria-labelledby={`item-title-${props.mode}`} onCancel={event => { event.preventDefault(); setSelected(null); }}>
      {selected && <><header className={s.detailHeader}><ItemIcon category={selected.category} definitionId={selected.definitionId} /><h3 id={`item-title-${props.mode}`}>{selected.name}</h3><button className={s.close} aria-label="关闭物品详情" onClick={() => setSelected(null)}>×</button></header><dl className={s.facts}><div><dt>类型</dt><dd>{names[selected.category]}物品</dd></div><div><dt>基础等级</dt><dd>{selected.level}</dd></div><div><dt>数量</dt><dd>{selected.quantity}</dd></div></dl>{selected.effect && <div className={s.effect}><b>{selected.category === 'material' ? '用途' : '关键效果'}</b><p>{selected.effect}</p></div>}<button className={s.back} onClick={() => setSelected(null)}>返回背包</button></>}
    </dialog>
  </>;
}
