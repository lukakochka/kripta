import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const MiniTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value != null);
  return (
    <div style={{ background: 'rgba(4,11,24,0.97)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.72rem' }}>
      <div style={{ color: 'var(--blue)', marginBottom: 4, fontWeight: 700 }}>{label}</div>
      {items.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: p.color }}>{Number(p.value).toFixed(4)}</span>
        </div>
      ))}
    </div>
  );
};

const HistogramBar = (props) => {
  const { x, y, width, height, value } = props;
  if (!value) return null;
  const color = value > 0 ? 'rgba(0,223,162,0.65)' : 'rgba(255,71,87,0.65)';
  return <rect x={x} y={y} width={Math.max(1, width)} height={Math.max(1, Math.abs(height))} fill={color} rx={1} />;
};

function IndicatorSection({ title, currentValue, valueColor, children, height = 160 }) {
  return (
    <div style={{ flex: 1, minHeight: height, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border)' }}>
      <div style={{ padding: '6px 12px', fontSize: '0.67rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {title}
        {currentValue != null && (
          <span style={{ fontFamily: 'var(--mono)', color: valueColor || 'var(--text-primary)', fontWeight: 800, fontSize: '0.8rem' }}>
            {currentValue}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

export default function IndicatorsChart({ indicatorData }) {
  const hasData = indicatorData && indicatorData.some(d => d.rsi != null || d.macd != null);

  if (!hasData) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{ fontSize: '2rem' }}>📈</div>
        <div style={{ color: 'var(--text-secondary)' }}>Вычисление индикаторов…</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Нужно минимум 26 ценовых точек (RSI: 14, MACD: 26)</div>
      </div>
    );
  }

  const lastRSI = [...indicatorData].reverse().find(d => d.rsi != null)?.rsi;
  const lastMACD = [...indicatorData].reverse().find(d => d.macd != null)?.macd;
  const rsiColor = lastRSI < 30 ? 'var(--green)' : lastRSI > 70 ? 'var(--red)' : 'var(--text-primary)';
  const macdColor = (lastMACD ?? 0) > 0 ? 'var(--green)' : 'var(--red)';

  const commonAxis = {
    tick: { fontSize: 10, fill: '#2a4060' },
    axisLine: false,
    tickLine: false,
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

      {/* RSI */}
      <IndicatorSection
        title="RSI (14)"
        currentValue={lastRSI != null ? lastRSI.toFixed(1) : '—'}
        valueColor={rsiColor}
        height={180}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={indicatorData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="time" {...commonAxis} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} {...commonAxis} width={28} ticks={[0, 30, 50, 70, 100]} />
            <Tooltip content={<MiniTooltip />} />
            {/* Overbought/Oversold zones */}
            <ReferenceLine y={70} stroke="rgba(255,71,87,0.45)" strokeDasharray="4 3"
              label={{ value: '70 Overbought', position: 'insideTopRight', fontSize: 9, fill: 'rgba(255,71,87,0.7)' }} />
            <ReferenceLine y={30} stroke="rgba(0,223,162,0.45)" strokeDasharray="4 3"
              label={{ value: '30 Oversold', position: 'insideBottomRight', fontSize: 9, fill: 'rgba(0,223,162,0.7)' }} />
            <ReferenceLine y={50} stroke="rgba(255,255,255,0.07)" />
            <Line type="monotone" dataKey="rsi" stroke="#00b4ff" strokeWidth={2}
              dot={false} name="RSI" isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </IndicatorSection>

      {/* MACD */}
      <IndicatorSection
        title="MACD (12, 26, 9)"
        currentValue={lastMACD != null ? lastMACD.toFixed(4) : '—'}
        valueColor={macdColor}
        height={180}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={indicatorData} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="time" {...commonAxis} interval="preserveStartEnd" />
            <YAxis {...commonAxis} width={48}
              tickFormatter={v => v.toFixed(1)}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<MiniTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
            <Bar dataKey="histogram" name="Histogram" isAnimationActive={false} shape={<HistogramBar />} />
            <Line type="monotone" dataKey="macd" stroke="#00b4ff" strokeWidth={1.8} dot={false} name="MACD" isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="macdSignal" stroke="#fbbf24" strokeWidth={1.8} strokeDasharray="4 3" dot={false} name="Signal" isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </IndicatorSection>

      {/* Legend */}
      <div style={{ padding: '8px 12px', display: 'flex', gap: 16, fontSize: '0.67rem', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          ['#00b4ff', 'RSI / MACD Line'],
          ['#fbbf24', 'Signal Line'],
          ['rgba(0,223,162,0.75)', 'Bull Histogram'],
          ['rgba(255,71,87,0.75)', 'Bear Histogram'],
        ].map(([c, l]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
            <span style={{ width: 12, height: 2, background: c, display: 'inline-block', borderRadius: 1 }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}
