import type { ReactNode } from 'react';
import { useTutorial } from './tutorial-context';
import s from './tutorial.module.css';

interface CardProps { title: string; text: string; step: number; action?: string; onAction?: () => void; floating?: boolean; compact?: boolean }
export function TutorialCard(props: CardProps) {
  const guide = useTutorial();
  if (!guide.active) return null;
  const className = `${s.card} ${props.floating ? s.floating : ''} ${props.compact ? s.compact : ''}`;
  if (!guide.expanded) return <aside className={className}><button className={s.resume} onClick={() => { void guide.act('expand'); }} disabled={guide.busy}>◇ 新手指引 · {props.title} ▾</button></aside>;
  return <aside className={className} aria-label="新手指引">
    <header><span>◇ 新手指引 · {props.step}/5</span><div className={s.controls}><button onClick={() => { void guide.act('collapse'); }} disabled={guide.busy}>收起</button><button aria-label="关闭新手指引" onClick={() => { void guide.act('disable'); }} disabled={guide.busy}>关闭</button></div></header>
    <strong>{props.title}</strong><p>{props.text}</p>
    {props.action && props.onAction && <button className={s.action} onClick={props.onAction} disabled={guide.busy}>{props.action} →</button>}
    {guide.error && <p className={s.error} role="status">{guide.error}<button onClick={() => { void guide.refresh(); }} disabled={guide.busy}>同步指引</button></p>}
  </aside>;
}

export function TutorialHint(props: { show: boolean; title: string; children?: ReactNode }) {
  const guide = useTutorial();
  if (!props.show || !guide.expanded) return null;
  return <aside className={s.hint} role="status"><span aria-hidden="true">➜</span><div><strong>{props.title}</strong>{props.children && <p>{props.children}</p>}</div></aside>;
}

export function TutorialSettings() {
  const guide = useTutorial();
  const complete = guide.phase === 'done';
  return <section className={s.settings}>
    <strong>新手指引</strong><p>{complete ? '已完成首次构筑、秘境优化和角色成长。' : '黄色提示会指向商店、构筑、秘境与角色成长，可随时收起。'}</p>
    {!complete && <button disabled={guide.busy} onClick={() => { const action = guide.data?.enabled ? 'disable' : 'enable'; void guide.act(action); }}>{guide.data?.enabled ? '关闭新手指引' : '开启新手指引'}</button>}
    {guide.data?.enabled && guide.data.collapsed && !complete && <button disabled={guide.busy} onClick={() => { void guide.act('expand'); }}>展开指引</button>}
    {(!guide.data || guide.error) && <p role="status">{guide.error || '正在读取引导进度…'}<button disabled={guide.busy} onClick={() => { void guide.refresh(); }}>同步指引</button></p>}
  </section>;
}
