import { useState } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatUSD, formatPct } from '../../utils/formatter';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function BacktestPanel({ activeCoin }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [interval, setIntervalV] = useState('5m');

  const runBacktest = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      // Try backend first
      const res = await fetch(`${API_BASE}/backtest/${activeCoin}?interval=${interval}&limit=200`, { signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch {
      // Offline: run client-side backtest using Binance historical data
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${activeCoin}USDT&interval=${interval}&limit=200`);
        const candles = await res.json();
        const result = runClientBacktest(candles);
        setResult(result);
      } catch (e2) {
        setError('Не удалось загрузить данные: ' + e2.message);
      }
    }
    setRunning(false);
  };

  function runClientBacktest(candles) {
    const prices = candles.map(c => parseFloat(c[4]));
    const times = candles.map(c => new Date(c[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    let balance = 10000, position = null;
    const trades = [], equity = [{ time: times[0], equity: balance }];

    for (let i = 20; i < prices.length; i++) {
      const slice = prices.slice(Math.max(0, i - 20), i + 1);
      const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
      const curr = prices[i];
      const prev = prices[i - 1];
      const momentum = (curr - prices[i - 5]) / prices[i - 5];
      const gains = [], losses = [];
      for (let j = 1; j < Math.min(15, i); j++) {
        const d = prices[i - j + 1] - prices[i - j];
        if (d > 0) gains.push(d); else losses.push(-d);
      }
      const avgG = gains.reduce((a, b) => a + b, 0) / (gains.length || 1);
      const avgL = losses.reduce((a, b) => a + b, 0) / (losses.length || 1);
      const rsi = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);

      if (position) {
        const pct = (curr - position.entry) / position.entry;
        if (pct <= -0.005 || pct >= 0.012 || (rsi > 68 && pct > 0)) {
          const profit = position.amount * pct;
          balance += position.amount + profit;
          trades.push({ type: pct >= 0 ? 'PROFIT' : 'LOSS', entry: position.entry, exit: curr, profit: +profit.toFixed(2), profit_pct: +(pct * 100).toFixed(3), time: times[i] });
          position = null;
          equity.push({ time: times[i], equity: +balance.toFixed(2) });
        }
      } else {
        const amount = Math.min(1000, balance * 0.1);
        if (curr > sma && momentum > 0.001 && rsi < 62 && rsi > 35 && balance >= 1000) {
          balance -= amount;
          position = { entry: curr, amount };
        }
      }
    }

    const wins = trades.filter(t => t.type === 'PROFIT');
    const losses_t = trades.filter(t => t.type === 'LOSS');
    const returns = trades.map(t => t.profit_pct / 100);
    const mean = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length || 1));
    const sharpe = std > 0 ? +(mean / std * Math.sqrt(252 * 288)).toFixed(2) : 0;
    const eqVals = equity.map(e => e.equity);
    let peak = eqVals[0], maxDD = 0;
    for (const v of eqVals) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > maxDD) maxDD = dd; }

    return {
      trades: trades.slice(-30),
      equity_curve: equity,
      statistics: {
        total_trades: trades.length,
        win_trades: wins.length,
        loss_trades: losses_t.length,
        win_rate: +(wins.length / (trades.length || 1) * 100).toFixed(1),
        total_return: +((balance - 10000) / 10000 * 100).toFixed(2),
        sharpe_ratio: sharpe,
        max_drawdown: +(maxDD * 100).toFixed(2),
        avg_profit: +(wins.reduce((a, t) => a + t.profit, 0) / (wins.length || 1)).toFixed(2),
        avg_loss: +(losses_t.reduce((a, t) => a + t.profit, 0) / (losses_t.length || 1)).toFixed(2),
        final_balance: +balance.toFixed(2)
      }
    };
  }

  const s = result?.statistics;
  const totalROI = s?.total_return ?? 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '12px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={interval} onChange={e => setIntervalV(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
          {[['1m', '1 мин'], ['5m', '5 мин'], ['15m', '15 мин'], ['1h', '1 час']].map(([v, l]) => (
            <option key={v} value={v}>{l} · {activeCoin}</option>
          ))}
        </select>
        <button className="backtest-btn" style={{ flex: 2 }} onClick={runBacktest} disabled={running}>
          {running ? '⏳ Тестирование…' : `▶ Запустить бэктест · ${activeCoin}USDT`}
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--red-dim)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 8, color: 'var(--red)', fontSize: '0.8rem', marginBottom: 10 }}>
          ⚠ {error}
        </div>
      )}

      {!result && !running && (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🔬</div>
          <div style={{ color: 'var(--text-secondary)' }}>Нажмите «Запустить бэктест» для анализа 200 свечей</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 6 }}>Работает без Python бэкенда (данные с Binance)</div>
        </div>
      )}

      {result && (
        <>
          <div className="stats-grid" style={{ marginBottom: 10 }}>
            <div className="stat-card">
              <div className="stat-label">Win Rate</div>
              <div className="stat-value" style={{ color: s.win_rate > 55 ? 'var(--green)' : s.win_rate > 40 ? 'var(--yellow)' : 'var(--red)' }}>{s.win_rate}%</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.win_trades}W / {s.loss_trades}L из {s.total_trades}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Общий возврат</div>
              <div className="stat-value" style={{ color: totalROI >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatPct(totalROI)}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>{formatUSD(s.final_balance)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sharpe Ratio</div>
              <div className="stat-value" style={{ color: s.sharpe_ratio > 1 ? 'var(--green)' : s.sharpe_ratio > 0 ? 'var(--yellow)' : 'var(--red)' }}>{s.sharpe_ratio}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Max Drawdown</div>
              <div className="stat-value" style={{ color: s.max_drawdown < 5 ? 'var(--green)' : s.max_drawdown < 15 ? 'var(--yellow)' : 'var(--red)' }}>{s.max_drawdown}%</div>
            </div>
          </div>

          {result.equity_curve?.length > 1 && (
            <>
              <div className="section-label">Equity Curve</div>
              <div style={{ height: 180, marginBottom: 10 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equity_curve} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={totalROI >= 0 ? '#00dfa2' : '#ff4757'} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={totalROI >= 0 ? '#00dfa2' : '#ff4757'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#2a4060' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#2a4060' }} axisLine={false} tickLine={false} width={60}
                      tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: 'rgba(4,11,24,0.97)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.72rem' }}
                      formatter={v => [`$${v.toFixed(2)}`, 'Баланс']} />
                    <Area type="monotone" dataKey="equity" stroke={totalROI >= 0 ? 'var(--green)' : 'var(--red)'}
                      strokeWidth={2} fill="url(#btGrad)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {result.trades?.length > 0 && (
            <>
              <div className="section-label">Сделки в бэктесте</div>
              <table className="ledger-table">
                <thead>
                  <tr style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                    <td>Тип</td><td>Вход</td><td>Выход</td><td>P&L</td><td>%</td>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.slice(-12).reverse().map((t, i) => (
                    <tr key={i}>
                      <td><span className={`badge badge-${t.type === 'PROFIT' ? 'profit' : 'loss'}`}>{t.type}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>${parseFloat(t.entry).toFixed(2)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem' }}>${parseFloat(t.exit).toFixed(2)}</td>
                      <td style={{ fontFamily: 'var(--mono)', color: t.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                        {t.profit >= 0 ? '+' : ''}${t.profit}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', color: t.profit_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {t.profit_pct >= 0 ? '+' : ''}{t.profit_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
