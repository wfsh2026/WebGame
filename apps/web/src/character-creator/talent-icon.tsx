import type { ReactNode } from 'react';
export function TalentIcon({ name }: { name: string }) {
  const drawings: Record<string, ReactNode> = {
    brute: <><path d="M9 30q3-9 10-9l6 2 3-8-5-4 4-5 9 7 1 13q8 4 5 12-14 12-29 1Z" fill="#bc8964"/><path d="M14 31q12-9 20 0M28 23l-5 6M16 39q14 5 22-4" fill="none" stroke="#f5c89a" strokeWidth="3"/></>,
    arcane: <><path d="m7 12 17 3 17-3-3 28-15-3-17 3Z" fill="#e8d49f"/><path d="m24 15-1 22M11 18l9 2m-10 4 9 2m-10 4 9 2" stroke="#a98950" strokeWidth="2"/><path d="m32 15 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#75e1dd"/></>,
    healthy: <><path d="M24 42 7 24C-3 7 18 1 24 14 33-1 52 10 41 25Z" fill="#d95d48" stroke="#f3b27d" strokeWidth="2"/><path d="M24 20v13m-6-7h12" stroke="#ffe4a0" strokeWidth="4" strokeLinecap="round"/></>,
    reservoir: <><path d="m19 5 14 2-2 14q18 15 6 24H12Q1 33 19 19Z" fill="#75d7e0" stroke="#d3e9cf" strokeWidth="2"/><path d="M13 29q11-5 24 2l-2 10H15Z" fill="#2199b0"/><path d="m18 4 16 2-1 7-16-2Z" fill="#b99564"/><path d="m13 32 2 6" stroke="#d8ffff" strokeWidth="3"/></>,
    light: <><path d="M12 23 31 17l-3 15 13 7-2 6H7l-2-5 7-10Z" fill="#ba8a50" stroke="#ead198" strokeWidth="2"/><path d="m20 26 4-14L44 3 32 25l-11 7Z" fill="#e6eee3"/><path d="m23 26 15-16m-9 10 9-1" stroke="#8aa99b" strokeWidth="2"/></>,
    weapon: <><path d="m7 4 8 3 26 31-4 4L10 13Z" fill="#d0dfd8"/><path d="m41 4-8 3L7 38l4 4 27-29Z" fill="#adbdbe"/><path d="m5 30 13 12m12-1 13-12" stroke="#d8ae55" strokeWidth="4"/><path d="m9 38-5 7m34-7 6 7" stroke="#9e6543" strokeWidth="5"/></>,
    casting: <><path d="m10 43 23-26" stroke="#bf8c55" strokeWidth="6"/><path d="m32 3 4 10 11 4-11 4-4 11-4-11-10-4 10-4Z" fill="#e8c86c"/><path d="m32 9 3 8-3 8-3-8Z" fill="#79e5e3"/><path d="m9 7 2 5 5 1-5 2-2 5-1-5-5-2 5-1Z" fill="#84d9df"/></>,
    frail: <><path d="M24 43 8 25C-3 9 17 1 24 14 33 0 51 10 40 26Z" fill="#80527f" stroke="#d3a78a" strokeWidth="2"/><path d="m26 12-7 11 7 3-8 13" fill="none" stroke="#f3c6aa" strokeWidth="3"/></>,
    slow: <><circle cx="19" cy="25" r="15" fill="#687b74" stroke="#adbaac" strokeWidth="2"/><path d="m9 24 9-10 9 10-6 12H12Z" fill="#465c56"/><path d="m30 36 11 8m-12-6 9-2m-4 5 5-7" stroke="#aaa68b" strokeWidth="3"/><circle cx="11" cy="18" r="3" fill="#b8cdc0"/></>,
    shallow: <><path d="m19 5 14 2-2 14q18 15 6 24H12Q1 33 19 19Z" fill="#7f9594" stroke="#bfc6b1" strokeWidth="2"/><path d="M12 37q14-4 25 1l-2 5H15Z" fill="#bba888"/><path d="m18 4 16 2-1 7-16-2Z" fill="#987e5e"/><path d="m25 21-4 8 6 3-4 7" fill="none" stroke="#d7c8ab" strokeWidth="2"/></>
  };
  const drawing = drawings[name] ?? drawings.arcane;
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="talent-illustration">{drawing}</svg>;
}
