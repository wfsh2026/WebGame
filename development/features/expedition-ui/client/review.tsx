import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, SyntheticEvent } from 'react';
import type { LobbyViewProps } from '../../../../apps/web/src/online/lobby-view';
import { Expeditions } from '../../../../apps/web/src/lobby/camp/expeditions';
import background from '../../../../content/common/lobby/camp-background-shop-ground.webp';
import camp from '../../../../apps/web/src/lobby/camp/camp.module.css';

const query = new URLSearchParams(location.search);
const scenario = query.get('case') ?? 'default';
const codes = ['k7mP2xQ9a', 'n4vR8cL2b', 'p6hT3wK5d'];
const population = [3, 1, 8];
const count = scenario === 'empty' ? 0 : scenario === 'many' ? 11 : 3;
const rooms: LobbyViewProps['rooms'] = Array.from({ length: count }, (_, index) => {
  const fallback = `testRoom${index + 1}`;
  const roomId = scenario === 'long' ? `long-room-code-${index}-abcdefghijklmnopqrstuvwxyz0123456789` : codes[index] ?? fallback;
  return { roomId, name: scenario === 'long' ? '很长的秘境房间名称与同行者展示' : '林地围猎', clients: scenario === 'full' && index === 0 ? 20 : population[index] ?? 1, maxClients: 20 };
});

export default function ExpeditionReview() {
  const [busy, setBusy] = useState(scenario === 'busy');
  const [opened, setOpened] = useState(true);
  const [lastRequest, setLastRequest] = useState('none');
  const [requests, setRequests] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const current = dialog.current; if (opened) current?.showModal(); else current?.close(); }, [opened]);
  async function enterRoom(id?: string): Promise<void> {
    setLastRequest(id ?? 'create'); setRequests(previous => previous + 1); setBusy(true);
    try {
      const waiting = new Promise<void>(resolve => { window.setTimeout(resolve, 600); });
      await waiting;
      if (scenario === 'request-error') throw new Error('房间已关闭，请重新选择房间。');
    } finally { setBusy(false); }
  }
  function close(): void { if (!busy) setOpened(false); }
  function open(): void { setOpened(true); }
  function cancel(event: SyntheticEvent<HTMLDialogElement>): void { event.preventDefault(); close(); }
  function backdrop(event: MouseEvent<HTMLDialogElement>): void { if (event.target === event.currentTarget) close(); }
  const style: CSSProperties = { position: 'fixed', inset: 0, background: `url(${background}) center / cover no-repeat` };
  const error = scenario === 'error' ? '房间服务暂时不可用，请稍后重试。' : '';
  return <main className={camp.root} data-last-request={lastRequest} data-requests={requests}>
    <div style={style} />
    {!opened && <button style={{ position: 'relative' }} onClick={open}>打开秘境界面</button>}
    <dialog ref={dialog} className={`${camp.dialog} ${camp.expeditionDialog}`} aria-labelledby="camp-panel-title" onCancel={cancel} onClick={backdrop}>
      <section className={`${camp.panel} ${camp.expeditionPanel}`}><div className={camp.panelBody}><Expeditions rooms={rooms} busy={busy} error={error} enterRoom={enterRoom} onClose={close} /></div></section>
    </dialog>
  </main>;
}
