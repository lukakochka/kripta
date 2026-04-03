import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function MetricCard({ label, value, color, sub }) {
  return (
    <div className="stat-card" style={{ borderColor: `${color}30` }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const AccTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(4,11,24,0.97)', border: '1px solid rgba(0,180,255,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: '0.73rem' }}>
      <div style={{ color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
          <span style={{ color: p.color, fontFamily: 'var(--mono)', fontWeight: 700 }}>
            ${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
      {payload.length >= 2 && payload[0]?.value != null && payload[1]?.value != null && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Error: </span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: Math.abs(payload[0].value - payload[1].value) < 10 ? 'var(--green)' : 'var(--yellow)' }}>
            ${Math.abs((payload[0].value || 0) - (payload[1].value || 0)).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
};

export default function ForecastAccuracy({ forecastHistory }) {
  if (!forecastHistory || forecastHistory.length < 3) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: '2rem' }}>🎯</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Collecting forecast data…</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Will appear after ~3 AI cycles (9 seconds)</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i <= forecastHistory.length ? 'var(--blue)' : 'var(--border)', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>
    );
  }

  // Calculate metrics
  const lstmErrors = forecastHistory.filter(d => d.lstm != null && d.actual != null)
    .map(d => Math.abs(d.lstm - d.actual));
  const rfErrors = forecastHistory.filter(d => d.rf != null && d.actual != null)
    .map(d => Math.abs(d.rf - d.actual));

  const lstmMAE = lstmErrors.length ? (lstmErrors.reduce((a, b) => a + b, 0) / lstmErrors.length) : 0;
  const rfMAE = rfErrors.length ? (rfErrors.reduce((a, b) => a + b, 0) / rfErrors.length) : 0;

  const lstmPcts = forecastHistory.filter(d => d.lstm != null && d.actual != null)
    .map(d => Math.abs((d.lstm - d.actual) / d.actual) * 100);
  const lstmMAPE = lstmPcts.length ? (lstmPcts.reduce((a, b) => a + b, 0) / lstmPcts.length) : 0;
  const rfPcts = forecastHistory.filter(d => d.rf != null && d.actual != null)
    .map(d => Math.abs((d.rf - d.actual) / d.actual) * 100);
  const rfMAPE = rfPcts.length ? (rfPcts.reduce((a, b) => a + b, 0) / rfPcts.length) : 0;

  const betterModel = lstmMAE <= rfMAE ? 'LSTM' : 'RandomForest';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '10px 12px' }}>
      <div style={{ marginBottom: 10, fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Каждые 3 секунды AI делает прогноз на следующий тик. Здесь видна разница между <span style={{ color: 'var(--blue)' }}>реальной ценой</span> и прогнозами.
      </div>

      {/* Metrics */}
      <div className="stats-grid" style={{ marginBottom: 12 }}>
        <MetricCard label="LSTM MAE" value={`$${lstmMAE.toFixed(2)}`} color="var(--yellow)" sub={`MAPE: ${lstmMAPE.toFixed(3)}%`} />
        <MetricCard label="RF MAE" value={`$${rfMAE.toFixed(2)}`} color="var(--purple)" sub={`MAPE: ${rfMAPE.toFixed(3)}%`} />
        <MetricCard label="Лучшая модель" value={betterModel} color="var(--green)" sub={`Точнее на $${Math.abs(rfMAE - lstmMAE).toFixed(2)}`} />
        <MetricCard label="Точек данных" value={forecastHistory.length} color="var(--blue)" sub="накоплено" />
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={forecastHistory} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#2a4060' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 9, fill: '#2a4060', fontFamily: 'var(--mono)' }}
              axisLine={false} tickLine={false} width={70}
              domain={['auto', 'auto']}
              tickFormatter={v => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            />
            <Tooltip content={<AccTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.7rem', paddingTop: 8 }} />
            <Line type="monotone" dataKey="actual" stroke="#00b4ff" strokeWidth={2.5} dot={{ r: 2, fill: '#00b4ff' }} name="Реальная цена" isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="lstm" stroke="#fbbf24" strokeWidth={1.8} strokeDasharray="5 3" dot={{ r: 2, fill: '#fbbf24' }} name="Прогноз LSTM" isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="rf" stroke="#8b5cf6" strokeWidth={1.8} strokeDasharray="5 3" dot={{ r: 2, fill: '#8b5cf6' }} name="Прогноз RF" isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Last Predictions Table */}
      <div style={{ marginTop: 10 }}>
        <div className="section-label" style={{ marginTop: 0 }}>Последние прогнозы</div>
        <table className="ledger-table" style={{ width: '100%' }}>
          <thead>
            <tr style={{ color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
              <td>Время</td><td>Реальная</td><td>LSTM</td><td>Ошибка LSTM</td><td>RF</td><td>Ошибка RF</td>
            </tr>
          </thead>
          <tbody>
            {[...forecastHistory].reverse().slice(0, 8).map((d, i) => {
              const lstmErr = d.lstm != null && d.actual != null ? Math.abs(d.lstm - d.actual) : null;
              const rfErr = d.rf != null && d.actual != null ? Math.abs(d.rf - d.actual) : null;
              return (
                <tr key={i} style={{ fontSize: '0.7rem' }}>
                  <td style={{ color: 'var(--text-secondary)' }}>{d.time}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--blue)' }}>${d.actual?.toFixed(2) ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>${d.lstm?.toFixed(2) ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: lstmErr != null && lstmErr < (d.actual * 0.001) ? 'var(--green)' : 'var(--red)' }}>
                    {lstmErr != null ? `$${lstmErr.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--purple)' }}>${d.rf?.toFixed(2) ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: rfErr != null && rfErr < (d.actual * 0.001) ? 'var(--green)' : 'var(--red)' }}>
                    {rfErr != null ? `$${rfErr.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
