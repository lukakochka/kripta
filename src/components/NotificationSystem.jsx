import { useState, useEffect, useRef } from 'react';

let notifId = 0;

export function useNotifications() {
  const [notifs, setNotifs] = useState([]);

  const push = (type, title, message) => {
    const id = ++notifId;
    setNotifs(prev => [...prev.slice(-4), { id, type, title, message, exiting: false }]);
    setTimeout(() => dismiss(id), 5000);
  };

  const dismiss = (id) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, exiting: true } : n));
    setTimeout(() => setNotifs(prev => prev.filter(n => n.id !== id)), 280);
  };

  return { notifs, push, dismiss };
}

const ICONS = { buy: '🟢', sell: '🔴', hold: '🟡', alert: '⚡', trade: '💰', info: 'ℹ️' };
const COLORS = { buy: 'var(--green)', sell: 'var(--red)', hold: 'var(--yellow)', alert: 'var(--blue)', trade: 'var(--purple)', info: 'var(--text-secondary)' };

export default function NotificationSystem({ notifs, onDismiss }) {
  return (
    <div className="notif-container">
      {notifs.map(n => (
        <div key={n.id} className={`notif-toast${n.exiting ? ' exiting' : ''}`} style={{ borderColor: `${COLORS[n.type]}40`, position: 'relative', overflow: 'hidden' }}>
          <span className="notif-icon">{ICONS[n.type] || '🔔'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="notif-title" style={{ color: COLORS[n.type] }}>{n.title}</div>
            <div className="notif-msg">{n.message}</div>
          </div>
          <button className="notif-close" onClick={() => onDismiss(n.id)}>×</button>
          <div className="notif-progress" style={{ background: COLORS[n.type] }} />
        </div>
      ))}
    </div>
  );
}
