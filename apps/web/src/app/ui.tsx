import type { CSSProperties, ReactNode } from 'react';
import s from './app.module.css';

type IconName = 'portal' | 'compass' | 'person' | 'bag' | 'history' | 'arrow' | 'coin' | 'gem' | 'users' | 'clock' | 'check' | 'exit' | 'spark';
const paths: Record<IconName, string> = {
  portal: 'M5 21V10a7 7 0 0 1 14 0v11h-4V10a3 3 0 0 0-6 0v11z M12 11l2 4-2 4-2-4z',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M16 8l-3 5-5 3 3-5z',
  person: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M5 21v-3a7 7 0 0 1 14 0v3',
  bag: 'M5 7h14l1 14H4z M8 8V6a4 4 0 0 1 8 0v2 M9 13h6',
  history: 'M4 5v5h5 M4 10a8 8 0 1 1 1 8 M12 7v5l3 2',
  arrow: 'M4 12h15 M13 6l6 6-6 6',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12',
  gem: 'M7 4h10l5 7-10 10L2 11z M2 11h20 M7 4l5 17 5-17',
  users: 'M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M3 20v-4a6 6 0 0 1 12 0v4 M17 4a3 3 0 0 1 0 6 M18 13a5 5 0 0 1 3 5v2',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 6v6l4 2',
  check: 'M5 12l4 4L19 6',
  exit: 'M9 4H4v16h5 M10 12h11 M16 7l5 5-5 5',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Button({ children, onClick, secondary = false, disabled = false, type = 'button' }: { children: ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean; type?: 'button' | 'submit' }) {
  const className = secondary ? `${s.button} ${s.secondary}` : s.button;
  return <button className={className} onClick={onClick} disabled={disabled} type={type}>{children}</button>;
}

export function PortalArt({ variant = 'forest', large = false }: { variant?: string; large?: boolean }) {
  const colors = variant === 'sand' ? ['#efd9bb', '#c98155', '#efd0a0', '#a95b3d', '#f2e6ce'] : variant === 'tide' ? ['#dce9e9', '#7ea6ae', '#c2d9df', '#416d7a', '#edf2e9'] : ['#e2e8cf', '#739178', '#bfd0a0', '#315c4c', '#edf0dc'];
  const style: CSSProperties = { width: '100%', height: '100%' };
  return <svg viewBox="0 0 480 300" style={style} role="img" aria-label={large ? '通往未知秘境的森林石门插画' : '秘境风景插画'}>
    <path fill={colors[0]} d="M0 0h480v300H0z" />
    <circle cx="366" cy="65" r="30" fill={colors[4]} />
    <path d="M0 185 80 115 130 158 215 82 300 164 390 108 480 170v130H0z" fill={colors[2]} />
    <path d="M0 219q95-75 184-18t160-4 136 10v93H0z" fill={colors[1]} />
    <ellipse cx="248" cy="267" rx="157" ry="21" fill={colors[3]} opacity=".16" />
    <path d="M108 252 163 201 320 201 375 252 294 280 184 280z" fill={colors[4]} />
    <path d="M190 238V132a54 54 0 0 1 108 0v106h-23V132a31 31 0 0 0-62 0v106z" fill={colors[3]} />
    <path d="M214 238V132a30 30 0 0 1 60 0v106z" fill={colors[2]} />
    <path d="m243 149 14 25-14 25-14-25z" fill={colors[4]} />
    <path d="m244 238-33 62h73l-26-62z" fill={colors[0]} />
    <path d="M180 138h34 M275 138h34 M180 182h34 M275 182h34" stroke={colors[1]} strokeWidth="3" />
    <path d="M75 226v-69 M44 192l31-69 31 69z M49 170l26-59 26 59z M376 224v-76 M343 189l33-79 33 79z M351 164l25-63 25 63z" fill={colors[3]} stroke={colors[3]} strokeWidth="6" strokeLinejoin="round" />
    <path d="m117 243-16-13 18-15 21 13z M333 248l-12-13 20-10 22 16z" fill={colors[1]} />
    <circle cx="151" cy="180" r="3" fill={colors[4]} /><circle cx="329" cy="135" r="3" fill={colors[4]} /><circle cx="310" cy="211" r="4" fill={colors[4]} />
    <path d="M65 263h43 M365 263h22 M131 79h17 M139 71v16 M331 57h11 M336 52v11" stroke={colors[4]} strokeWidth="2" />
  </svg>;
}

export function RoleFigure({ role, small = false }: { role: string; small?: boolean }) {
  const cloak = role === 'guardian' ? '#be8568' : role === 'mage' ? '#9290b8' : '#638b77';
  const size = small ? 60 : 160;
  return <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="冒险者角色形象">
    <ellipse cx="80" cy="145" rx="39" ry="8" fill="#243e3320" />
    <path d="m59 84-17 54h76l-17-54z" fill={cloak} />
    <path d="M65 123v23h12l3-22 3 22h12v-23" fill="#344c46" />
    <path d="m61 87-15 24 M99 87l15 24" stroke={cloak} strokeWidth="13" strokeLinecap="round" />
    <circle cx="80" cy="62" r="24" fill="#e6be9b" />
    <path d="M55 64V53a25 25 0 0 1 50 0v16L92 51 77 59 63 55z" fill="#344c46" />
    <path d="m58 81 22 12 22-12-9 32H67z" fill={cloak} />
    <path d="M76 68h1 M88 68h1" stroke="#344c46" strokeWidth="3" strokeLinecap="round" />
    {role === 'mage' ? <><path d="m116 125 9-82" stroke="#765b46" strokeWidth="5" /><path d="m126 22 10 16-12 16-10-16z" fill="#bbb7dc" /></> : role === 'guardian' ? <path d="M108 88l22 8-3 25-19 14-18-14-3-25z" fill="#d7c8a8" stroke="#9c765e" strokeWidth="4" /> : <><path d="M115 65q30 33-2 66" fill="none" stroke="#b99a60" strokeWidth="5" /><path d="m114 65-1 66" stroke="#e9dcc1" strokeWidth="2" /></>}
  </svg>;
}
