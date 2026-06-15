import { useEffect, useState } from 'react';
import { onRateLimit, getRateLimit } from '../api/gist';
import { useAuth } from '../hooks/useAuth';

export default function RateLimitBanner({ threshold }) {
  const { activeGitHubToken } = useAuth();
  const [info, setInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const alertThreshold = threshold || 500;

  useEffect(() => {
    if (!activeGitHubToken) return;
    // Initial check
    getRateLimit(activeGitHubToken).then(i => { if (i) setInfo(i); });
    // Subscribe to updates from mutations
    const unsub = onRateLimit(i => { setInfo(i); setDismissed(false); });
    // Poll every 5 minutes
    const interval = setInterval(() => getRateLimit(activeGitHubToken).then(i => { if (i) setInfo(i); }), 5 * 60 * 1000);
    return () => { unsub(); clearInterval(interval); };
  }, [activeGitHubToken]);

  if (!info || dismissed) return null;
  if (info.remaining > alertThreshold) return null;

  const resetTime = new Date(info.reset * 1000).toLocaleTimeString('ru');
  const pct = Math.round((info.remaining / info.limit) * 100);
  const isCritical = info.remaining < 100;

  return (
    <div className={`rate-limit-banner ${isCritical ? 'rate-critical' : 'rate-warn'}`}>
      <span className="rate-icon">{isCritical ? '🔴' : '🟡'}</span>
      <span>
        {isCritical
          ? `Критически мало запросов к GitHub API: осталось ${info.remaining} из ${info.limit}. Сохрани и экспортируй данные!`
          : `Запросов к GitHub API осталось: ${info.remaining} из ${info.limit} (${pct}%). Сброс в ${resetTime}`
        }
      </span>
      <button className="rate-dismiss" onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
