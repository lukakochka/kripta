import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calcSharpeRatio, calcMaxDrawdown } from '../../utils/indicators';
import { formatUSD, formatPct } from '../../utils/formatter';

function StatCard({ label, value, sub, color = 'var(--text-primary)', icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon && <span style={{ marginRight: 4 }}>{icon}</span>}{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function StatsPanel({ tradeLogs, equityCurve, balance }) {
  if (!tradeLogs || tradeLogs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ fontSize: '2rem' }}>📊</div>
        <div style={{ color: 'var(--text-secondary)' }}>Статистика появится после первых сделок</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Paper Trading Engine автоматически торгует</div>
      </div>
    );
  }

  const wins = tradeLogs.filter(t => t.type === 'PROFIT');
  const losses = tradeLogs.filter(t => t.type === 'LOSS');
  const winRate = tradeLogs.length > 0 ? (wins.length / tradeLogs.length) * 100 : 0;
  const totalProfit = tradeLogs.reduce((a, t) => a + (t.profit || 0), 0);
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.profit, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, t) => a + t.profit, 0) / losses.length : 0;

  const returns = tradeLogs.map(t => (t.profit || 0) / 1000);
  const sharpe = calcSharpeRatio(returns);
  const equityVals = equityCurve.map(e => e.equity || e.value || 0);
  const maxDD = calcMaxDrawdown(equityVals.length ? equityVals : [balance]);
  const totalROI = ((balance - 10000) / 10000) * 100;
  const profitFactor = losses.length > 0 && Math.abs(avgLoss) > 0
    ? Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length) : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '12px' }}>

      <div className="stats-grid">
        <StatCard icon="🏆" label="Win Rate" value={`${winRate.toFixed(1)}%`}
          color={winRate > 55 ? 'var(--green)' : winRate > 40 ? 'var(--yellow)' : 'var(--red)'}
          sub={`${wins.length}W / ${losses.length}L`} />
        <StatCard icon="📈" label="Total ROI" value={formatPct(totalROI)}
          color={totalROI >= 0 ? 'var(--green)' : 'var(--red)'}
          sub={formatUSD(totalProfit)} />
        <StatCard icon="⚡" label="Sharpe Ratio" value={sharpe.toFixed(2)}
          color={sharpe > 1 ? 'var(--green)' : sharpe > 0 ? 'var(--yellow)' : 'var(--red)'}
          sub={sharpe > 1 ? 'Отличный' : sharpe > 0 ? 'Приемлемый' : 'Плохой'} />
        <StatCard icon="📉" label="Max Drawdown" value={`${maxDD.toFixed(2)}%`}
          color={maxDD < 5 ? 'var(--green)' : maxDD < 15 ? 'var(--yellow)' : 'var(--red)'}
          sub="от пика" />
        <StatCard icon="💰" label="Avg Win" value={formatUSD(avgWin)}
          color="var(--green)" sub="средняя прибыль" />
        <StatCard icon="🔻" label="Avg Loss" value={formatUSD(avgLoss)}
          color="var(--red)" sub="средний убыток" />
        <StatCard icon="⚖️" label="Profit Factor" value={profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
          color={profitFactor > 1.5 ? 'var(--green)' : profitFactor > 1 ? 'var(--yellow)' : 'var(--red)'}
          sub="прибыль / убытки" />
        <StatCard icon="🔢" label="Сделок" value={tradeLogs.length}
          color="var(--blue)" sub="всего" />
      </div>

      {/* Equity Curve */}
      {equityCurve.length > 1 && (
        <>
          <div className="section-label">Equity Curve (Paper Trading)</div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurve} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={totalROI >= 0 ? '#00dfa2' : '#ff4757'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={totalROI >= 0 ? '#00dfa2' : '#ff4757'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#2a4060' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#2a4060', fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} width={60}
                  tickFormatter={v => `$${(v/1000).toFixed(1)}k`} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'rgba(4,11,24,0.97)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.72rem' }}
                  formatter={v => [`$${v.toFixed(2)}`, 'Баланс']}
                />
                <Area type="monotone" dataKey="equity" stroke={totalROI >= 0 ? 'var(--green)' : 'var(--red)'}
                  strokeWidth={2} fill="url(#equityGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Trade History */}
      <div className="section-label" style={{ marginTop: 14 }}>История сделок</div>
      <table className="ledger-table">
        <thead>
          <tr style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
            <td>Тип</td><td>Монета</td><td>P&L</td><td>Время</td>
          </tr>
        </thead>
        <tbody>
          {tradeLogs.slice(0, 10).map((log, i) => (
            <tr key={i}>
              <td><span className={`badge badge-${log.type === 'PROFIT' ? 'profit' : 'loss'}`}>{log.type}</span></td>
              <td style={{ color: 'var(--text-secondary)' }}>{log.coin}</td>
              <td style={{ fontFamily: 'var(--mono)', color: log.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                {log.profit >= 0 ? '+' : ''}${log.profit?.toFixed(2)}
              </td>
              <td style={{ color: 'var(--text-muted)' }}>{log.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
