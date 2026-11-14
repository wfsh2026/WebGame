import { experienceNeeded } from '@web-game-world/simulation';
import { useEffect, useRef, useState } from 'react';
import s from './experience-bar.module.css';

export function ExperienceBar({ level, experience }: { level: number; experience: number }) {
  const previous = useRef(level); const [upgraded, setUpgraded] = useState(false);
  useEffect(() => {
    const changed = level > previous.current; previous.current = level;
    if (!changed) return;
    setUpgraded(true); const timer = window.setTimeout(() => setUpgraded(false), 650);
    return () => window.clearTimeout(timer);
  }, [level]);
  const required = experienceNeeded(level); const ratio = experience / required * 100;
  const bounded = Math.min(100, ratio); const width = level >= 100 ? 100 : Math.max(0, bounded);
  const value = level >= 100 ? '已满级' : `${experience}/${required}`;
  const label = `局内等级 ${level}，经验 ${value}`;
  return <div className={s.experience} data-upgraded={upgraded} aria-label={label}>
    <b className={s.level}>Lv.{level}</b>
    <div className={s.track} role="progressbar" aria-label="局内经验" aria-valuemin={0} aria-valuemax={required} aria-valuenow={level >= 100 ? required : experience}><span key={level} style={{ width: `${width}%` }} /></div>
    <span className={s.value}>经验 {value}</span>
  </div>;
}
