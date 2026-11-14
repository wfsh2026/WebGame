import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { tutorialStateSchema } from '@web-game-world/contracts';
import type { TutorialAction, TutorialMilestone, TutorialStateData } from '@web-game-world/contracts';
import { request } from '../../network/online';

type Phase = 'shop' | 'build' | 'expedition' | 'battle' | 'growth' | 'done';
interface Session { token: string; accountId: string; refreshNeeded?: boolean }
interface TutorialContextValue {
  data: TutorialStateData | null;
  phase: Phase;
  active: boolean;
  expanded: boolean;
  busy: boolean;
  error: string;
  connect: (session: Session) => void;
  refresh: () => Promise<boolean>;
  act: (action: TutorialAction) => Promise<boolean>;
  mark: (action: TutorialAction) => void;
}
const eventMilestones: Partial<Record<TutorialAction, TutorialMilestone>> = {
  'shop-reviewed': 'shop', 'build-reviewed': 'build', 'combat-entered': 'entered', 'reward-picked': 'reward', 'battle-build-viewed': 'battle-build', 'growth-viewed': 'growth-viewed'
};
const TutorialContext = createContext<TutorialContextValue | null>(null);

function phaseFor(data: TutorialStateData | null): Phase {
  const milestones = data?.milestones ?? [];
  const settled = milestones.includes('settled');
  if (settled && !milestones.includes('allocated')) return 'growth';
  if (settled && milestones.includes('allocated') && milestones.includes('reward') && milestones.includes('battle-build')) return 'done';
  if (milestones.includes('entered')) return 'battle';
  if (!milestones.includes('shop')) return 'shop';
  return milestones.includes('build') ? 'expedition' : 'build';
}

export function TutorialProvider(props: { children: ReactNode }) {
  const [data, setData] = useState<TutorialStateData | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(0);
  const session = useRef<Session>({ token: '', accountId: '' });
  const current = useRef<TutorialStateData | null>(null);
  const emptyQueue = Promise.resolve(true);
  const initialMarking = new Set<TutorialAction>();
  const initialRetryEvents = new Set<TutorialAction>();
  const queue = useRef<Promise<boolean>>(emptyQueue);
  const marking = useRef(initialMarking);
  const retryEvents = useRef(initialRetryEvents);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const enqueue = useCallback((action?: TutorialAction): Promise<boolean> => {
    const owner = session.current;
    if (!owner.token || !owner.accountId) return Promise.resolve(false);
    setPending(count => count + 1);
    const operation = async (): Promise<boolean> => {
      if (!mounted.current || session.current !== owner) return false;
      try {
        if (!current.current || !action || owner.refreshNeeded) {
          const options = { token: owner.token };
          const response = await request('tutorial', options);
          if (!mounted.current || session.current !== owner) return false;
          current.current = tutorialStateSchema.parse(response);
          owner.refreshNeeded = false;
        }
        if (action && current.current) {
          const body = { action, revision: current.current.revision };
          const options = { token: owner.token, body };
          const response = await request('tutorial', options);
          if (!mounted.current || session.current !== owner) return false;
          current.current = tutorialStateSchema.parse(response);
          retryEvents.current.delete(action);
        }
        setData(current.current); setError('');
        return true;
      } catch (cause) {
        if (mounted.current && session.current === owner) {
          const detail = cause instanceof Error ? cause.message : '新手指引暂未同步';
          setError(`${detail}，可同步后继续。`);
          // 下次操作先读取服务器状态，恢复超时或多页面修改后的进度。
          owner.refreshNeeded = true;
          if (action && eventMilestones[action]) retryEvents.current.add(action);
        }
        return false;
      } finally {
        if (mounted.current && session.current === owner) setPending(count => Math.max(0, count - 1));
      }
    };
    const next = queue.current.then(operation, operation);
    queue.current = next;
    return next;
  }, []);
  const refresh = useCallback(async (): Promise<boolean> => {
    const owner = session.current;
    const loaded = await enqueue();
    if (!loaded || session.current !== owner) return false;
    const events = [...retryEvents.current];
    for (const event of events) {
      if (session.current !== owner) return false;
      const saved = await enqueue(event);
      if (!saved) return false;
    }
    return true;
  }, [enqueue]);
  const act = useCallback((action: TutorialAction) => enqueue(action), [enqueue]);
  const connect = useCallback((next: Session): void => {
    if (session.current.accountId === next.accountId && session.current.token === next.token) return;
    session.current = next; current.current = null; marking.current = new Set(); retryEvents.current = new Set();
    queue.current = Promise.resolve(true); setData(null); setError(''); setPending(0);
    if (next.accountId && next.token) void refresh();
  }, [refresh]);
  const mark = useCallback((action: TutorialAction): void => {
    const state = current.current;
    const milestone = eventMilestones[action];
    if (!state?.enabled || !milestone || state.milestones.includes(milestone) || marking.current.has(action)) return;
    const owner = session.current;
    marking.current.add(action);
    const operation = act(action);
    void operation.finally(() => { if (session.current === owner) marking.current.delete(action); });
  }, [act]);

  const phase = phaseFor(data);
  const active = Boolean(data?.enabled && phase !== 'done');
  const expanded = active && !data?.collapsed;
  const value: TutorialContextValue = { data, phase, active, expanded, busy: pending > 0, error, connect, refresh, act, mark };
  return <TutorialContext.Provider value={value}>{props.children}</TutorialContext.Provider>;
}

const inactive: TutorialContextValue = {
  data: null, phase: 'shop', active: false, expanded: false, busy: false, error: '',
  connect: () => {}, refresh: async () => false, act: async () => false, mark: () => {}
};
export function useTutorial(): TutorialContextValue {
  const value = useContext(TutorialContext);
  return value ?? inactive;
}
