import { useState } from 'react';
import { formatUSD, formatPrice } from '../utils/formatter';
import AIInsightsModal from './AIInsightsModal';

const getSentimentLabel = (idx) => {
  if (idx >= 70) return { label: 'Extreme Greed', color: 'var(--green)' };
  if (idx >= 55) return { label: 'Greed', color: '#4ade80' };
  if (idx >= 45) return { label: 'Neutral', color: 'var(--yellow)' };
  if (idx >= 30) return { label: 'Fear', color: '#fb923c' };
  return { label: 'Extreme Fear', color: 'var(--red)' };
};

function SentimentGauge({ index }) {
  const { label, color } = getSentimentLabel(index);
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="gauge-wrap" style={{ marginBottom: 6 }}>
        <div className="gauge-track" />
        <div className="gauge-thumb" style={{ left: `${index}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        <span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '1.6rem', fontWeight: 800, color }}>{index}</span>
        <span style={{ color, fontWeight: 600, fontSize: '0.82rem', marginLeft: 8 }}>{label}</span>
      </div>
    </div>
  );
}

function RLAgent({ rlAgent }) {
  const action = rlAgent?.action ?? 'HOLD';
  const qVals = rlAgent?.q_values ?? [0, 0, 0];
  const rlBalance = rlAgent?.balance ?? 0;
  const maxQ = Math.max(...qVals.map(Math.abs), 0.001);

  const actionColor = action === 'BUY' ? 'var(--green)' : action === 'SELL' ? 'var(--red)' : 'var(--yellow)';
  const actionClass = action.toLowerCase();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <div className={`badge badge-${actionClass}`} style={{ padding: '8px 28px', fontSize: '1rem' }}>
          {action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '🟡'} {action}
        </div>
      </div>

      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Q-Values (Sell / Hold / Buy)</div>
      <div className="qbar-wrap">
        {['SELL', 'HOLD', 'BUY'].map((lbl, i) => {
          const v = qVals[i] ?? 0;
          const h = Math.max(4, (Math.abs(v) / maxQ) * 44);
          const col = i === 0 ? 'var(--red)' : i === 1 ? 'var(--yellow)' : 'var(--green)';
          return (
            <div key={lbl} className="qbar-col">
              <div className="qbar-val" style={{ color: col }}>{v.toFixed(3)}</div>
              <div className="qbar-fill" style={{ height: h, background: col, opacity: action === lbl ? 1 : 0.25 }} />
              <div className="qbar-lbl">{lbl}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: 6 }}>
        <span style={{ color: 'var(--text-secondary)' }}>RL Virtual P&L</span>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: rlBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {rlBalance >= 0 ? '+' : ''}{rlBalance.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function PaperTrading({ balance, position, tradeLogs, prices }) {
  const roi = ((balance - 10000) / 10000 * 100);
  const openPnl = position
    ? position.amount * ((prices[position.coin] - position.entryPrice) / position.entryPrice)
    : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Виртуальный баланс</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', fontWeight: 800 }}>${balance.toFixed(2)}</div>
          <div style={{ fontSize: '0.68rem', color: roi >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
            {roi >= 0 ? '▲' : '▼'} {Math.abs(roi).toFixed(3)}% ROI
          </div>
        </div>

        {position ? (
          <div style={{ flex: 1, background: 'rgba(0,223,162,0.05)', border: '1px solid rgba(0,223,162,0.2)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Позиция: {position.coin}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '1.1rem', fontWeight: 800, color: openPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {openPnl >= 0 ? '+' : ''}{formatUSD(openPnl)}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Вход: ${formatPrice(position.entryPrice)}</div>
          </div>
        ) : (
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Нет позиции</span>
          </div>
        )}
      </div>

      {tradeLogs.length > 0 && (
        <>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: 5 }}>Последние сделки</div>
          <table className="ledger-table">
            <tbody>
              {tradeLogs.slice(0, 5).map((log, i) => (
                <tr key={i}>
                  <td><span className={`badge badge-${log.type === 'PROFIT' ? 'profit' : 'loss'}`}>{log.type}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{log.coin}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '0.7rem', color: log.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {log.profit >= 0 ? '+' : ''}${log.profit?.toFixed(2)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {tradeLogs.length === 0 && (
        <div className="empty-state">Ожидание AI сигналов…</div>
      )}
    </div>
  );
}

export default function RightPanel({ newsData, rlAgent, balance, position, tradeLogs, prices, activeCoin, historyData }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const sentimentIdx = newsData?.index ?? 50;
  const articles = newsData?.articles ?? [];

  return (
    <div className="panel panel-right">
      <div className="panel-header">
        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>AI Intelligence</div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>NLP · RL · Paper Trading</div>
      </div>

      <div className="panel-scroll">
        {/* NLP Sentiment */}
        <div className="section-label" style={{ marginTop: 0 }}>📰 NLP Sentiment</div>
        <div className="card">
          <SentimentGauge index={sentimentIdx} />
          {articles.slice(0, 3).map((a, i) => {
            const sc = a.score > 0.05 ? 'var(--green)' : a.score < -0.05 ? 'var(--red)' : 'var(--text-secondary)';
            return (
              <div key={i} className="news-item">
                <div className="news-title">{a.title?.slice(0, 65)}{a.title?.length > 65 ? '…' : ''}</div>
                <div className="news-meta">
                  <span style={{ color: 'var(--text-muted)' }}>{a.source}</span>
                  <span style={{ color: sc, fontWeight: 700, fontSize: '0.65rem' }}>
                    {a.score > 0.05 ? '▲ Bullish' : a.score < -0.05 ? '▼ Bearish' : '● Neutral'}
                  </span>
                </div>
              </div>
            );
          })}
          {articles.length === 0 && <div className="empty-state">Загрузка новостей…</div>}
        </div>

        {/* RL Agent */}
        <div className="section-label">🎮 RL Agent (Q-Learning)</div>
        <div className="card">
          <RLAgent rlAgent={rlAgent} />
        </div>

        {/* Paper Trading */}
        <div className="section-label">💸 Paper Trading</div>
        <div className="card">
          <PaperTrading balance={balance} position={position} tradeLogs={tradeLogs} prices={prices} />
        </div>

        {/* AI Analysis Report Action */}
        <div style={{ padding: '4px 12px 16px' }}>
          <button 
            className="btn-primary" 
            style={{ 
              width: '100%', padding: '12px', fontSize: '0.82rem', 
              background: 'linear-gradient(135deg, var(--blue), #4f46e5)',
              boxShadow: '0 0 15px rgba(0,180,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
            }}
            onClick={() => setIsModalOpen(true)}
          >
            <span style={{ fontSize: '1.1rem' }}>🧠</span> Сгенерировать AI-отчет
          </button>
        </div>

        <div style={{ height: 16 }} />
      </div>

      <AIInsightsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        symbol={activeCoin}
        data={historyData}
      />
    </div>
  );
}
