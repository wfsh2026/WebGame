import { useState } from 'react';
import type { FormEvent } from 'react';
import { roles } from '../app/demo-data';
import type { RoleId } from '../app/demo-data';
import { Button, Icon, PortalArt, RoleFigure } from '../app/ui';
import s from '../app/app.module.css';

export function Onboarding({ choosingRole, name, onRegister, onChoose }: { choosingRole: boolean; name: string; onRegister: (name: string) => void; onChoose: (role: RoleId) => void }) {
  const [nickname, setNickname] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleId>('ranger');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > 12) {
      setError('请填写 1～12 个字的冒险者昵称');
      return;
    }
    onRegister(trimmed);
  }

  function choose() { onChoose(selectedRole); }

  const roleCards = roles.map((role) => {
    function select() { setSelectedRole(role.id); }
    const className = selectedRole === role.id ? `${s.roleCard} ${s.selected}` : s.roleCard;
    const stats = role.stats.map((stat) => <span key={stat}>{stat}</span>);
    return <button type="button" key={role.id} className={className} onClick={select} aria-pressed={selectedRole === role.id}>
      <span className={s.roleBadge}>{role.title}</span><RoleFigure role={role.id} />
      <h3>{role.name}</h3><p>{role.description}</p><div className={s.roleStats}>{stats}</div>
    </button>;
  });

  return <div className={s.welcome}>
    <header className={s.welcomeHeader}><a className={s.brand} href="/"><span className={s.brandMark}><Icon name="portal" size={25} /></span><span>秘境之间<small>INTO THE RIFT</small></span></a><span className={s.demoPill}>本地体验版</span></header>
    {choosingRole ? <main className={s.roleSetup}><span className={s.eyebrow}>YOUR FIRST CHAPTER</span><h1>{name}，选择你的起点</h1><p className={s.muted}>不同的旅人，相同的好奇心。以你喜欢的姿态出发。</p><div className={s.roleGrid}>{roleCards}</div><Button onClick={choose}>以此身份启程 <Icon name="arrow" /></Button><p className={s.caption}>角色属性仅为界面示意，实际职业能力尚未设定。</p></main> : <main className={s.welcomeGrid}>
      <section className={s.welcomeCopy}><span className={s.eyebrow}>A LITTLE COURAGE. A NEW WORLD.</span><h1>未知很远，<br />冒险从这里开始<span>。</span></h1><p>穿过秘境，遇见同行者。<br />在一次次探索中，找到属于你的成长。</p><form onSubmit={submit} className={s.registerForm}><label htmlFor="nickname">为你的冒险者取个名字</label><input id="nickname" value={nickname} maxLength={12} placeholder="例如：林间来客" autoComplete="nickname" onChange={(event) => { const value = event.target.value; setNickname(value); setError(''); }} aria-describedby="account-hint" required /><Button type="submit">创建体验角色 <Icon name="arrow" /></Button>{error && <span role="alert" className={s.error}>{error}</span>}<small id="account-hint">当前创建本机演示档案，无需密码，不会注册真实账号。</small></form></section>
      <section className={s.welcomeArt}><div className={s.artNumber}>CHAPTER / 001</div><PortalArt large /><div className={s.artFooter}><span><i className={s.statusDot} />秘境之门已经开启</span><span>下一站 · 未知</span></div></section>
    </main>}
    <footer className={s.welcomeFooter}><span>一起探索，一起成长。</span><span>FLAT WORLD · ENDLESS POSSIBILITIES</span></footer>
  </div>;
}
