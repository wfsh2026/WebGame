import { useEffect, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import s from './reward-ui.module.css';

interface Props { title: string; children: ReactNode; close: () => void }

export function RewardDialog(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    const parent = panel?.parentElement?.closest('dialog');
    function parentClosed(event: Event): void { if (event.target === parent) props.close(); }
    parent?.addEventListener('close', parentClosed);
    panel?.showModal();
    return () => { parent?.removeEventListener('close', parentClosed); if (panel?.open) panel.close(); };
  }, []);
  function cancel(event: SyntheticEvent<HTMLDialogElement>): void { event.stopPropagation(); event.preventDefault(); props.close(); }
  return <dialog ref={dialog} className={s.detailDialog} aria-label={props.title} onCancel={cancel} onClick={event => { if (event.target === event.currentTarget) props.close(); }}>
    <header><h2>{props.title}</h2><button className={s.close} aria-label={`关闭${props.title}`} onClick={props.close}>×</button></header>{props.children}
  </dialog>;
}
