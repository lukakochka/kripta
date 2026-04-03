import { formatPrice, formatPct } from '../utils/formatter';

const SYMBOLS = {
  BTCUSDT: { name: 'Bitcoin', short: 'BTC', color: '#f59e0b' },
  ETHUSDT: { name: 'Ethereum', short: 'ETH', color: '#818cf8' },
  SOLUSDT: { name: 'Solana', short: 'SOL', color: '#00dfa2' },
  TONUSDT: { name: 'Toncoin', short: 'TON', color: '#38bdf8' },
};

function AnalyticsRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: valueColor || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function BarChart({ value, maxValue = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / maxValue) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--mono)', color: 'var(--text-primary)', width: 32, textAlign: 'right' }}>{Math.round(value)}%</span>
    </div>
  );
}

export default function Sidebar({ prices, prevPrices, activeCoin, setActiveCoin, macroSentiment, aiConfidence, imbalances, rsiValues }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="logo-text">CryptoOracle</div>
        <div className="logo-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div className="live-dot" />
          PRO v4 · Live Market Feed
        </div>
      </div>

      <div className="panel-scroll">
        <div className="section-label">Markets</div>

        {Object.values(SYMBOLS).map(({ short, name, color }) => {
          const curr = prices[short] || 0;
          const prev = prevPrices[short] || curr;
          const isUp = curr >= prev;
          const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
          return (
            <div key={short} className={`coin-card ${activeCoin === short ? 'active' : ''}`} onClick={() => setActiveCoin(short)} id={`coin-${short}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}60` }} />
                <div>
                  <div className="coin-name">{short}</div>
                  <div className="coin-full">{name}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`coin-price ${isUp ? 'up' : 'down'}`}>${formatPrice(curr)}</div>
                <div className={`coin-pct ${isUp ? 'text-green' : 'text-red'}`}>
                  {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(3)}%
                </div>
              </div>
            </div>
          );
        })}

        <div className="section-label" style={{ marginTop: 16 }}>AI Analysis</div>

        <div className="card">
          <AnalyticsRow label="1H Trend" value={macroSentiment}
            valueColor={macroSentiment.includes('BULL') ? 'var(--green)' : macroSentiment.includes('BEAR') ? 'var(--red)' : 'var(--text-secondary)'} />
          <div style={{ paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>RF Confidence</span>
            </div>
            <BarChart value={aiConfidence}
              color={aiConfidence > 60 ? 'var(--green)' : aiConfidence > 35 ? 'var(--yellow)' : 'var(--red)'} />
          </div>
          <AnalyticsRow label="Order Book"
            value={(imbalances[activeCoin] || 0) > 0 ? '📈 Buy Pressure' : '📉 Sell Pressure'}
            valueColor={(imbalances[activeCoin] || 0) > 0 ? 'var(--green)' : 'var(--red)'} />
        </div>

        {rsiValues && (
          <>
            <div className="section-label">RSI Overview</div>
            <div className="card">
              {Object.values(SYMBOLS).map(({ short, color }) => {
                const rsi = rsiValues[short] ?? 50;
                const rsiColor = rsi < 30 ? 'var(--green)' : rsi > 70 ? 'var(--red)' : 'var(--text-primary)';
                const zone = rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral';
                return (
                  <div key={short} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ color, fontWeight: 700, fontSize: '0.72rem' }}>{short}</span>
                      <span style={{ color: rsiColor, fontSize: '0.72rem', fontFamily: 'var(--mono)' }}>
                        {rsi.toFixed(1)} · {zone}
                      </span>
                    </div>
                    <BarChart value={rsi} color={rsiColor} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="section-label">BTC Correlation</div>
        <div className="card">
          {Object.values(SYMBOLS).filter(s => s.short !== 'BTC').map(({ short, color }) => {
            const btcUp = (prices['BTC'] || 0) >= (prevPrices['BTC'] || prices['BTC'] || 0);
            const coinUp = (prices[short] || 0) >= (prevPrices[short] || prices[short] || 0);
            const aligned = btcUp === coinUp;
            return (
              <div key={short} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color, fontWeight: 700, fontSize: '0.72rem' }}>{short}</span>
                <span style={{ fontSize: '0.7rem', color: aligned ? 'var(--green)' : 'var(--red)' }}>
                  {aligned ? '⬆ Following BTC' : '⬇ Diverging'}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}

export { SYMBOLS };
