import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { testAssetsSchema } from '@web-game-world/contracts';
import type { TestAssetsData } from '@web-game-world/contracts';
import type { LobbyViewProps } from '../../online/lobby-view';
import s from './test-tools.module.css';

interface TestToolsProps {
  addInventory: LobbyViewProps['addTestInventory'];
  loadAssets: LobbyViewProps['loadTestAssets'];
  adjustAssets: LobbyViewProps['adjustTestAssets'];
  onBusyChange: (busy: boolean) => void;
}

export default function TestTools(props: TestToolsProps) {
  const [current, setCurrent] = useState<TestAssetsData | null>(null);
  const [coins, setCoins] = useState('');
  const [materials, setMaterials] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const grantRequest = useRef<string | null>(null);

  function showBalances(assets: TestAssetsData): void {
    const coinText = String(assets.coins);
    const materialText = String(assets.materials);
    setCurrent(assets); setCoins(coinText); setMaterials(materialText);
  }

  useEffect(() => {
    let active = true;
    if (!props.loadAssets) return;
    const request = props.loadAssets();
    void request.then(assets => { if (active) showBalances(assets); }).catch(cause => {
      if (active) { const message = cause instanceof Error ? cause.message : '资源读取失败，请重新加载'; setError(message); }
    });
    return () => { active = false; };
  }, [props.loadAssets]);

  async function addInventory(): Promise<void> {
    if (!props.addInventory || pending.current) return;
    pending.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice('');
    try {
      // 超时重试复用请求编号，避免同一次点击重复发放。
      if (!grantRequest.current) grantRequest.current = crypto.randomUUID();
      const count = await props.addInventory(grantRequest.current);
      grantRequest.current = null;
      setNotice(`已添加 ${count} 种测试物品，关闭测试工具后按 B 查看背包。`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '添加结果尚未确认，请点击重试';
      setError(message);
    } finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  async function refresh(): Promise<void> {
    if (!props.loadAssets || pending.current) return;
    pending.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice('');
    try { const assets = await props.loadAssets(); showBalances(assets); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '资源读取失败，请重试'; setError(message); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!props.adjustAssets || !current || pending.current) return;
    const values = { coins: Number(coins), materials: Number(materials) };
    const parsed = testAssetsSchema.safeParse(values);
    if (!parsed.success || coins.trim() === '' || materials.trim() === '') { setError('请输入 0～2147483647 之间的整数'); return; }
    const data = { ...parsed.data, expected: current };
    pending.current = true; setBusy(true); props.onBusyChange(true); setError(''); setNotice('');
    try { const assets = await props.adjustAssets(data); showBalances(assets); setNotice('金币和素材已保存。'); }
    catch (cause) { const message = cause instanceof Error ? cause.message : '保存结果暂未确认，请刷新余额后重试'; setError(message); }
    finally { pending.current = false; setBusy(false); props.onBusyChange(false); }
  }

  return <section className={s.tools} aria-label="测试工具">
    <p>调整当前测试账号的资源，输入调整后的目标数量。</p>
    <button type="button" onClick={refresh} disabled={busy}>刷新当前余额</button>
    {current ? <form className={s.form} onSubmit={save}>
      <label>金币<span>当前 {current.coins}</span><input type="number" min="0" max="2147483647" step="1" value={coins} onChange={event => setCoins(event.target.value)} disabled={busy} required /></label>
      <label>素材<span>当前 {current.materials}</span><input type="number" min="0" max="2147483647" step="1" value={materials} onChange={event => setMaterials(event.target.value)} disabled={busy} required /></label>
      <button type="submit" disabled={busy}>{busy ? '正在保存…' : '保存调整'}</button>
    </form> : !error && <p role="status">正在读取当前余额…</p>}
    {props.addInventory && <section className={s.inventory}>
      <h3>测试背包</h3><p>添加 2 种技能、3 种装备、3 种材料。再次添加时，技能与材料叠加，装备逐件新增。</p>
      <button type="button" onClick={addInventory} disabled={busy}>{busy ? '正在处理…' : '添加背包测试物品'}</button>
      <p>仅用于背包展示，不影响技能搭配与战斗属性。刷新网页会进入新测试账号。</p>
    </section>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
