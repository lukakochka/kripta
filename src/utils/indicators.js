// ─── Technical Indicators Library ────────────────────────────────────────────

export function calcEMA(prices, period) {
  if (!prices || prices.length < period) return new Array(prices?.length || 0).fill(null);
  const k = 2 / (period + 1);
  const result = new Array(prices.length).fill(null);
  let sma = 0;
  for (let i = 0; i < period; i++) sma += prices[i];
  result[period - 1] = sma / period;
  for (let i = period; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

export function calcRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return new Array(prices?.length || 0).fill(null);
  const result = new Array(prices.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function calcMACD(prices, fast = 12, slow = 26, signalP = 9) {
  const empty = { macd: [], signal: [], histogram: [] };
  if (!prices || prices.length < slow) return empty;
  const emaFast = calcEMA(prices, fast);
  const emaSlow = calcEMA(prices, slow);
  const macdLine = prices.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null
  );
  const validMacd = macdLine.filter(v => v !== null);
  const validIdx = macdLine.map((v, i) => (v !== null ? i : -1)).filter(i => i >= 0);
  const signalEMA = calcEMA(validMacd, signalP);
  const signalLine = new Array(prices.length).fill(null);
  validIdx.forEach((idx, j) => { signalLine[idx] = signalEMA[j]; });
  const histogram = prices.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null ? macdLine[i] - signalLine[i] : null
  );
  return { macd: macdLine, signal: signalLine, histogram };
}

export function calcBollingerBands(prices, period = 20, stdMult = 2) {
  if (!prices) return [];
  return prices.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + stdMult * std, middle: mean, lower: mean - stdMult * std };
  });
}

export function calcSharpeRatio(returns) {
  if (!returns || returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : +((mean / std) * Math.sqrt(252 * 24 * 20)).toFixed(2);
}

export function calcMaxDrawdown(equity) {
  if (!equity || equity.length === 0) return 0;
  let peak = equity[0], maxDD = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return +(maxDD * 100).toFixed(2);
}
