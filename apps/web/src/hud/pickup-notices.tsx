import { useSyncExternalStore } from 'react';
import type { PickupNoticeFeed } from './pickup-notice-feed';
import s from './pickup-notices.module.css';

export function PickupNotices({ feed }: { feed: PickupNoticeFeed }) {
  const notices = useSyncExternalStore(feed.subscribe, feed.read);
  return <div className={s.notices} role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text" data-pickup-notices>
    {notices.map(notice => <div key={notice.id} className={s.row} style={{ animationDuration: `${notice.duration}ms` }} data-pickup-notice>
      <div className={s.clip}><div className={s.text}>
        <span className={s.prefix}>获得：</span><span style={{ color: notice.nameColor }}>{notice.name}</span><span className={s.paren}>（</span><span style={{ color: notice.detailColor }} data-pickup-detail>{notice.detail}</span><span className={s.paren}>）</span>{notice.count > 1 && <span className={s.count}> ×{notice.count}</span>}
      </div></div>
    </div>)}
  </div>;
}
