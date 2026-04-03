import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value != null && p.dataKey !== 'bb_upper' && p.dataKey !== 'bb_lower' && p.dataKey !== 'bb_middle');
  if (!items.length) return null;
  return (
    <div style={{ background: 'rgba(4,11,24,0.97)', border: '1px solid rgba(0,180,255,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      <div style={{ color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {items.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff' }}>
            ${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function LiveChart({ chartData }) {
  const hasData = chartData && chartData.some(d => d.price != null);

  if (!hasData) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: '2rem' }}>📡</div>
        <div style={{ color: 'var(--text-secondary)' }}>Подключение к Binance WebSocket…</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Данные появятся через несколько секунд</div>
      </div>
    );
  }

  // Safe domain
  const allVals = chartData.flatMap(d =>
    [d.price, d.predict_browser, d.predict_python, d.bb_upper, d.bb_lower].filter(v => v != null && isFinite(v))
  );
  const minV = allVals.length ? Math.min(...allVals) : 0;
  const maxV = allVals.length ? Math.max(...allVals) : 1;
  const pad = Math.max((maxV - minV) * 0.08, 1);
  const domainMin = minV - pad;
  const domainMax = maxV + pad;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '4px 0 0' }}>
      {/* Chart — takes all available flex space */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#2a4060' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tick={{ fontSize: 10, fill: '#2a4060', fontFamily: 'var(--mono)' }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              width={72}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* BB Band fill between upper and lower */}
            <Area
              type="monotone" dataKey="bb_upper"
              fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.35)"
              strokeWidth={1} strokeDasharray="5 4"
              dot={false} name="BB Upper" isAnimationActive={false}
            />
            <Area
              type="monotone" dataKey="bb_lower"
              fill="rgba(139,92,246,0.06)" stroke="rgba(139,92,246,0.35)"
              strokeWidth={1} strokeDasharray="5 4"
              dot={false} name="BB Lower" isAnimationActive={false}
            />
            <Line type="monotone" dataKey="bb_middle" stroke="rgba(139,92,246,0.3)"
              strokeWidth={1} dot={false} name="BB Mid" isAnimationActive={false} />

            {/* RF Forecast */}
            <Line type="monotone" dataKey="predict_python" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4"
              dot={(props) => {
                const { cx, cy, value } = props;
                if (value == null) return null;
                return <circle key={`rf-${cx}`} cx={cx} cy={cy} r={3} fill="#8b5cf6" stroke="none" />;
              }}
              name="RF Forecast" isAnimationActive={false} connectNulls
            />

            {/* LSTM Forecast */}
            <Line type="monotone" dataKey="predict_browser" stroke="#fbbf24" strokeWidth={2}
              dot={(props) => {
                const { cx, cy, value } = props;
                if (value == null) return null;
                return <circle key={`lstm-${cx}`} cx={cx} cy={cy} r={3} fill="#fbbf24" stroke="none" />;
              }}
              name="LSTM Forecast" isAnimationActive={false} connectNulls
            />

            {/* Live price — rendered last = on top */}
            <Line type="monotone" dataKey="price" stroke="#00b4ff" strokeWidth={2.5}
              dot={false} name="Live Price" isAnimationActive={false} />

            {/* Forecast boundary marker */}
            {chartData.find(d => d.isForecastStart) && (
              <ReferenceLine
                x={chartData.find(d => d.isForecastStart)?.time}
                stroke="rgba(255,255,255,0.2)"
                strokeDasharray="4 4"
                label={{ value: 'Прогноз →', position: 'insideTopRight', fontSize: 10, fill: 'rgba(255,255,255,0.3)' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — fixed height */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: '0.67rem', padding: '6px 8px', borderTop: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          ['#00b4ff', 'Live (Binance WS)', 'solid'],
          ['#fbbf24', 'Brain.js LSTM', 'solid'],
          ['#8b5cf6', 'RandomForest', 'dashed'],
          ['rgba(139,92,246,0.6)', 'Bollinger Bands', 'dashed'],
        ].map(([c, l, s]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
            <span style={{ width: 20, height: 2, background: c, display: 'inline-block', borderRadius: 1, borderTop: s === 'dashed' ? `2px dashed ${c}` : 'none', background: s === 'dashed' ? 'none' : c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
