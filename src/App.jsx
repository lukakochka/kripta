import { useState, useEffect, useRef } from 'react';
import './index.css';

import Sidebar, { SYMBOLS } from './components/Sidebar';
import RightPanel from './components/RightPanel';
import NotificationSystem, { useNotifications } from './components/NotificationSystem';

import LiveChart from './components/tabs/LiveChart';
import IndicatorsChart from './components/tabs/IndicatorsChart';
import ForecastAccuracy from './components/tabs/ForecastAccuracy';
import BacktestPanel from './components/tabs/BacktestPanel';
import StatsPanel from './components/tabs/StatsPanel';

import { calcRSI, calcMACD, calcBollingerBands } from './utils/indicators';
import { formatPrice, formatTime } from './utils/formatter';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

const TABS = [
  { id: 'chart',      label: '📊 График' },
  { id: 'indicators', label: '📈 Индикаторы' },
  { id: 'accuracy',   label: '🎯 Прогноз vs Факт' },
  { id: 'backtest',   label: '🔬 Бэктест' },
  { id: 'stats',      label: '📉 Статистика' },
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const getSentimentInfo = (idx) => {
  if (idx >= 70) return { label: 'Extreme Greed', color: 'var(--green)' };
  if (idx >= 55) return { label: 'Greed', color: '#4ade80' };
  if (idx >= 45) return { label: 'Neutral', color: 'var(--yellow)' };
  if (idx >= 30) return { label: 'Fear', color: '#fb923c' };
  return { label: 'Extreme Fear', color: 'var(--red)' };
};

// ─── Build chart-ready data from history + indicators + forecasts ────────────
function buildChartData(history, brainForecast, pythonForecast) {
  if (!history.length) return [];

  const prices = history.map(d => d.price);
  const bbArr  = calcBollingerBands(prices);

  const base = history.map((d, i) => ({
    ...d,
    bb_upper:  bbArr[i]?.upper  ?? null,
    bb_middle: bbArr[i]?.middle ?? null,
    bb_lower:  bbArr[i]?.lower  ?? null,
  }));

  // Attach both forecast lines to the last real point
  if (base.length) {
    const last = base[base.length - 1];
    if (brainForecast.length)  last.predict_browser = last.price;
    if (pythonForecast.length) last.predict_python  = last.price;
    last.isForecastStart = true;
  }

  // Append 5 forecast points
  const extra = [];
  for (let i = 0; i < 5; i++) {
    const pt = { time: `+${i + 1}s`, price: null, bb_upper: null, bb_middle: null, bb_lower: null };
    if (brainForecast[i])  pt.predict_browser = brainForecast[i].predict_browser;
    if (pythonForecast[i]) pt.predict_python  = pythonForecast[i].predict;
    if (pt.predict_browser != null || pt.predict_python != null) extra.push(pt);
  }

  return [...base, ...extra];
}

// ─── Build indicator-chart data from history ─────────────────────────────────
function buildIndicatorData(history) {
  if (history.length < 4) return [];
  const prices = history.map(d => d.price);
  const rsiArr = calcRSI(prices);
  const { macd, signal: macdSig, histogram } = calcMACD(prices);

  return history.map((d, i) => ({
    time:       d.time,
    rsi:        rsiArr[i]    ?? null,
    macd:       macd[i]      ?? null,
    macdSignal: macdSig[i]   ?? null,
    histogram:  histogram[i] ?? null,
  }));
}

export default function App() {
  // ─── Core state ───────────────────────────────────────────────
  const [prices,     setPrices]     = useState({ BTC: 0, ETH: 0, SOL: 0, TON: 0 });
  const [prevPrices, setPrevPrices] = useState({ BTC: 0, ETH: 0, SOL: 0, TON: 0 });
  const [activeCoin, setActiveCoin] = useState('BTC');
  const [activeTab,  setActiveTab]  = useState('chart');

  // ─── Refs (no re-render needed) ───────────────────────────────
  const historyRef    = useRef([]);   // raw candle history for active coin
  const volumeRef     = useRef({ BTC: 0, ETH: 0, SOL: 0, TON: 0 });
  const prevPricesRef = useRef({});
  const imbalancesRef = useRef({ BTC: 0, ETH: 0, SOL: 0, TON: 0 });
  const pendingFcRef  = useRef(null); // pending forecast for accuracy check
  const prevRSIRef    = useRef({});
  const prevRLRef     = useRef('HOLD');
  const balanceRef    = useRef(10000);
  const positionRef   = useRef(null);

  // ─── Chart / indicator data ───────────────────────────────────
  const [chartData,     setChartData]     = useState([]);
  const [indicatorData, setIndicatorData] = useState([]);
  const [rsiValues,     setRsiValues]     = useState({ BTC: 50, ETH: 50, SOL: 50, TON: 50 });

  // ─── AI outputs ───────────────────────────────────────────────
  const [brainForecast,  setBrainForecast]  = useState([]);
  const [pythonForecast, setPythonForecast] = useState([]);
  const [macroSentiment, setMacroSentiment] = useState('SIDEWAYS');
  const [aiConfidence,   setAiConfidence]   = useState(0);
  const [imbalances,     setImbalances]     = useState({ BTC: 0, ETH: 0, SOL: 0, TON: 0 });
  const [newsData,       setNewsData]       = useState({ index: 50, articles: [] });
  const [rlAgent,        setRlAgent]        = useState({ action: 'HOLD', q_values: [0, 0, 0], balance: 0 });

  // ─── Paper Trading ────────────────────────────────────────────
  const [balance,     setBalance]     = useState(() => {
    const saved = localStorage.getItem('crypto_oracle_balance');
    return saved ? parseFloat(saved) : 10000;
  });
  const [position,    setPosition]    = useState(null);
  const [tradeLogs,   setTradeLogs]   = useState(() => {
    const saved = localStorage.getItem('crypto_oracle_trade_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [equityCurve, setEquityCurve] = useState(() => {
    const saved = localStorage.getItem('crypto_oracle_equity_curve');
    return saved ? JSON.parse(saved) : [{ time: formatTime(), equity: 10000 }];
  });

  // ─── Forecast accuracy ────────────────────────────────────────
  const [forecastHistory, setForecastHistory] = useState(() => {
    const saved = localStorage.getItem('crypto_oracle_forecast_history');
    return saved ? JSON.parse(saved) : { BTC: [], ETH: [], SOL: [], TON: [] };
  });

  // ─── Local Storage Sync ───
  useEffect(() => {
    localStorage.setItem('crypto_oracle_balance', balance);
    localStorage.setItem('crypto_oracle_trade_logs', JSON.stringify(tradeLogs));
    localStorage.setItem('crypto_oracle_equity_curve', JSON.stringify(equityCurve));
    localStorage.setItem('crypto_oracle_forecast_history', JSON.stringify(forecastHistory));
  }, [balance, tradeLogs, equityCurve, forecastHistory]);

  // ─── Notifications ────────────────────────────────────────────
  const { notifs, push: pushNotif, dismiss } = useNotifications();

  // ═══════════════════════════════════════════════════════════════
  // 1. WebSocket — Binance live prices + order book depth
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    let ws = null;
    let fallbackInterval = null;

    const connect = () => {
      const streams = Object.keys(SYMBOLS)
        .flatMap(s => [`${s.toLowerCase()}@trade`, `${s.toLowerCase()}@depth5@100ms`])
        .join('/');

      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data);
        if (!msg.data) return;

        const streamName = msg.stream;
        const symbol = streamName.split('@')[0].toUpperCase();
        const coin = SYMBOLS[symbol]?.short;
        if (!coin) return;

        if (streamName.includes('@trade')) {
          const price = parseFloat(msg.data.p);
          const qty   = parseFloat(msg.data.q);
          volumeRef.current[coin] = (volumeRef.current[coin] || 0) + qty;
          setPrices(prev => {
            prevPricesRef.current[coin] = prev[coin] || price;
            return { ...prev, [coin]: price };
          });
          setPrevPrices(prev => ({ ...prev, [coin]: prev[coin] || price }));
        } else if (streamName.includes('@depth5')) {
          const bids = msg.data.bids || [];
          const asks = msg.data.asks || [];
          const imb = bids.reduce((a, b) => a + parseFloat(b[1]), 0)
                    - asks.reduce((a, b) => a + parseFloat(b[1]), 0);
          imbalancesRef.current[coin] = imb;
          setImbalances(prev => ({ ...prev, [coin]: imb }));
        }
      };

      ws.onerror = () => setTimeout(connect, 5000);
      ws.onclose = () => setTimeout(connect, 5000);
    };

    // ─── Fallback Polling (Every 5s) ───
    // This ensures prices update even if WS is blocked or unstable for certain coins
    fallbackInterval = setInterval(async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price');
        const data = await res.json();
        const priceMap = {};
        data.forEach(item => {
          if (SYMBOLS[item.symbol]) {
            priceMap[SYMBOLS[item.symbol].short] = parseFloat(item.price);
          }
        });

        setPrices(prev => {
          const next = { ...prev };
          Object.keys(priceMap).forEach(c => {
            if (priceMap[c]) {
              prevPricesRef.current[c] = prev[c] || priceMap[c];
              next[c] = priceMap[c];
            }
          });
          return next;
        });
      } catch (e) { console.warn('Polling fallback error:', e); }
    }, 5000);

    connect();

    return () => {
      if (ws) ws.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 2. Fetch initial 60-candle history when active coin changes
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    historyRef.current = [];
    pendingFcRef.current = null; // Important: Reset pending forecast on coin switch
    setChartData([]);
    setIndicatorData([]);
    setBrainForecast([]);
    setPythonForecast([]);

    const load = async () => {
      try {
        const res  = await fetch(`https://api.binance.com/api/v3/klines?symbol=${activeCoin}USDT&interval=1m&limit=60`);
        const json = await res.json();
        const candles = json.map(k => ({
          time:         new Date(k[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price:        parseFloat(k[4]),
          volume:       parseFloat(k[5]) / 60,
          imbalance:    0,
          btc_momentum: 0,
        }));
        historyRef.current = candles;
        // Immediately render chart from historical data
        setChartData(buildChartData(candles, [], []));
        setIndicatorData(buildIndicatorData(candles));
        // Set RSI from history
        const prices = candles.map(d => d.price);
        const rsiArr = calcRSI(prices);
        const lastRSI = rsiArr[rsiArr.length - 1];
        if (lastRSI != null) {
          setRsiValues(prev => ({ ...prev, [activeCoin]: +lastRSI.toFixed(1) }));
          prevRSIRef.current[activeCoin] = lastRSI;
        }
      } catch { /* offline */ }
    };
    load();
  }, [activeCoin]);

  // ═══════════════════════════════════════════════════════════════
  // 3. 1-second tick: append candle, recompute indicators, update charts
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const brainRef   = { current: brainForecast };
    const pythonRef  = { current: pythonForecast };
    brainRef.current  = brainForecast;
    pythonRef.current = pythonForecast;

    const tick = setInterval(() => {
      const coinPrice = prices[activeCoin];
      if (!coinPrice) return;

      // Build new candle point
      const vol    = volumeRef.current[activeCoin] || 0;
      volumeRef.current[activeCoin] = 0;
      const btcMom = (prices['BTC'] || 0) - (prevPricesRef.current['BTC'] || prices['BTC'] || 0);

      const pt = {
        time:         new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price:        coinPrice,
        volume:       vol,
        imbalance:    imbalancesRef.current[activeCoin] || 0,
        btc_momentum: btcMom,
      };

      const history = [...historyRef.current, pt].slice(-80);
      historyRef.current = history;

      // RSI for all coins (active only — others refreshed on switch)
      const rawPrices = history.map(d => d.price);
      const rsiArr    = calcRSI(rawPrices);
      const lastRSI   = rsiArr[rsiArr.length - 1];

      if (lastRSI != null && isFinite(lastRSI)) {
        setRsiValues(prev => ({ ...prev, [activeCoin]: +lastRSI.toFixed(1) }));

        // RSI crossing notifications (outside of state updater)
        const prevRSI = prevRSIRef.current[activeCoin];
        if (prevRSI != null) {
          if (prevRSI >= 30 && lastRSI < 30)
            pushNotif('alert', `RSI Oversold · ${activeCoin}`, `RSI: ${lastRSI.toFixed(1)} — перепроданность`);
          else if (prevRSI <= 70 && lastRSI > 70)
            pushNotif('alert', `RSI Overbought · ${activeCoin}`, `RSI: ${lastRSI.toFixed(1)} — перекупленность`);
        }
        prevRSIRef.current[activeCoin] = lastRSI;
      }

      // Update chart + indicator data
      setChartData(buildChartData(history, brainForecast, pythonForecast));
      setIndicatorData(buildIndicatorData(history));
    }, 1000);

    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, activeCoin, brainForecast, pythonForecast]);

  // ═══════════════════════════════════════════════════════════════
  // 4. AI Engine — every 3 seconds
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const timer = setInterval(async () => {
      const history = historyRef.current;
      if (history.length < 12) return;

      const rawPrices  = history.map(d => d.price);
      const currPrice  = rawPrices[rawPrices.length - 1];

      // ── Resolve previous pending forecast for accuracy chart ──
      if (pendingFcRef.current) {
        const { lstm, rf } = pendingFcRef.current;
        setForecastHistory(prev => {
          const coinHistory = prev[activeCoin] || [];
          return {
            ...prev,
            [activeCoin]: [...coinHistory.slice(-49), {
              time:   formatTime(),
              actual: currPrice,
              lstm:   lstm,
              rf:     rf,
            }]
          };
        });
      }

      let pyMacro = macroSentiment;
      let pyConf  = aiConfidence;
      let newLSTM = null;
      let newRF   = null;

      // ── Python backend (RF + NLP + RL) ────────────────────────
      try {
        const payload = {
          symbol: activeCoin,
          data: history.map(d => ({
            time:         d.time,
            price:        d.price,
            volume:       d.volume || 0,
            imbalance:    d.imbalance || 0,
            btc_momentum: d.btc_momentum || 0,
          }))
        };
        const res  = await fetch(`${API_BASE}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2500),
        });
        const pyData = await res.json();

        if (pyData?.prediction?.length) {
          setPythonForecast(pyData.prediction);
          newRF = pyData.prediction[0]?.predict ?? null;
        }
        if (pyData?.macro)      { setMacroSentiment(pyData.macro);     pyMacro = pyData.macro; }
        if (pyData?.confidence != null) { setAiConfidence(pyData.confidence); pyConf = pyData.confidence; }
        if (pyData?.news)       setNewsData(pyData.news);
        if (pyData?.rl_agent) {
          const next = pyData.rl_agent;
          if (next.action !== prevRLRef.current) {
            pushNotif(next.action.toLowerCase(), `RL Signal: ${next.action} · ${activeCoin}`,
              `Q-Learning змінив сигнал на ${next.action}`);
            prevRLRef.current = next.action;
          }
          setRlAgent(next);
        }
      } catch { /* backend offline — LSTM only */ }

      // ── Brain.js LSTM ──────────────────────────────────────────
      try {
        if (typeof window.brain !== 'undefined' && rawPrices.length >= 8) {
          const WINDOW = Math.min(24, rawPrices.length - 1);
          const slice  = rawPrices.slice(-(WINDOW + 1));

          // Compute deltas and normalise to [0,1]
          const deltas = [];
          for (let i = 1; i < slice.length; i++) {
            deltas.push(slice[i] - slice[i - 1]);
          }
          const minD  = Math.min(...deltas);
          const maxD  = Math.max(...deltas);
          const diffD = maxD - minD || 1;
          const norm  = deltas.map(d => (d - minD) / diffD);

          const net = new window.brain.recurrent.LSTMTimeStep({ hiddenLayers: [16, 8] });
          net.train([norm], { iterations: 30, errorThresh: 0.04, log: false });

          const forecast = [];
          let seq   = [...norm];
          let lastP = rawPrices[rawPrices.length - 1];

          for (let i = 1; i <= 5; i++) {
            let nextNorm = net.run(seq);
            if (typeof nextNorm !== 'number' || isNaN(nextNorm)) nextNorm = 0.5;
            seq = [...seq.slice(1), nextNorm]; // slide window
            const delta = nextNorm * diffD + minD;
            const dampedDelta = delta * Math.pow(0.75, i); // decay to reduce drift
            const nextP = lastP + dampedDelta;
            forecast.push({ offset: i, predict_browser: isFinite(nextP) ? nextP : lastP });
            lastP = isFinite(nextP) ? nextP : lastP;
          }

          setBrainForecast(forecast);
          newLSTM = forecast[0]?.predict_browser ?? null;
        }
      } catch (e) { console.warn('LSTM error:', e.message); }

      // Store for next-cycle accuracy comparison
      pendingFcRef.current = { lstm: newLSTM, rf: newRF };

      // ── Paper Trading Engine ───────────────────────────────────
      const rlAction  = rlAgent.action;
      const sentIdx   = newsData?.index ?? 50;
      const pyFcState = pythonForecast; // use state value (previous cycle)
      const brFcState = brainForecast;

      const pyTarget  = pyFcState[2]?.predict;
      const brTarget  = brFcState[2]?.predict_browser;
      const predictedPyDelta = pyTarget ? (pyTarget - currPrice) / currPrice : 0;
      const predictedBrDelta = brTarget ? (brTarget - currPrice) / currPrice : 0;

      const pos = positionRef.current;
      if (pos) {
        const profitPct = (currPrice - pos.entryPrice) / pos.entryPrice;
        const shouldClose = predictedPyDelta < -0.0002
          || profitPct <= -0.002
          || profitPct >= 0.004
          || rlAction === 'SELL';

        if (shouldClose) {
          const profitUsd = pos.amount * profitPct;
          const newBal    = balanceRef.current + pos.amount + profitUsd;
          balanceRef.current  = newBal;
          positionRef.current = null;
          setPosition(null);
          setBalance(+newBal.toFixed(2));
          setEquityCurve(eq => [...eq.slice(-199), { time: formatTime(), equity: +newBal.toFixed(2) }]);
          setTradeLogs(logs => [{
            type:   profitUsd >= 0 ? 'PROFIT' : 'LOSS',
            coin:   pos.coin,
            profit: +profitUsd.toFixed(2),
            time:   new Date().toLocaleTimeString(),
          }, ...logs].slice(0, 30));
          pushNotif(
            profitUsd >= 0 ? 'trade' : 'sell',
            `Сделка закрыта · ${pos.coin}`,
            `${profitUsd >= 0 ? 'Прибыль' : 'Убыток'}: ${profitUsd >= 0 ? '+' : ''}$${Math.abs(profitUsd).toFixed(2)}`
          );
        }
      } else {
        const isBull =
          pyMacro.includes('BULL') &&
          pyConf > 55 &&
          predictedPyDelta > 0.0003 &&
          predictedBrDelta > 0.0003 &&
          rlAction === 'BUY' &&
          sentIdx > 35;

        if (isBull && balanceRef.current >= 500) {
          const amt = Math.min(1000, balanceRef.current * 0.1);
          const newBal = balanceRef.current - amt;
          const newPos = { coin: activeCoin, entryPrice: currPrice, amount: amt };
          balanceRef.current  = newBal;
          positionRef.current = newPos;
          setBalance(+newBal.toFixed(2));
          setPosition(newPos);
          pushNotif('buy', `Позиция открыта · ${activeCoin}`,
            `Long $${amt.toFixed(0)} @ $${formatPrice(currPrice)}`);
        }
      }
    }, 3000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCoin, rlAgent.action]);

  // ─── Derived ──────────────────────────────────────────────────
  const sentimentIdx  = newsData?.index ?? 50;
  const sentimentInfo = getSentimentInfo(sentimentIdx);
  const isUp = prices[activeCoin] >= prevPrices[activeCoin];

  return (
    <>
      <NotificationSystem notifs={notifs} onDismiss={dismiss} />
      <SpeedInsights />
      <Analytics />

      <div className="dashboard">
        {/* ── Left Sidebar ── */}
        <Sidebar
          prices={prices}
          prevPrices={prevPrices}
          activeCoin={activeCoin}
          setActiveCoin={setActiveCoin}
          macroSentiment={macroSentiment}
          aiConfidence={aiConfidence}
          imbalances={imbalances}
          rsiValues={rsiValues}
        />

        {/* ── Center Panel ── */}
        <div className="center-panel">

          {/* Header */}
          <div className="center-header">
            <div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-secondary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
                {SYMBOLS[`${activeCoin}USDT`]?.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div className={`price-main ${isUp ? 'up' : 'down'}`}>
                  ${formatPrice(prices[activeCoin])}
                </div>
                <div style={{
                  padding: '2px 8px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700,
                  background: isUp ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: isUp ? 'var(--green)' : 'var(--red)',
                  fontFamily: 'var(--mono)',
                }}>
                  {isUp ? '▲' : '▼'}{' '}
                  {prevPrices[activeCoin] > 0
                    ? (Math.abs((prices[activeCoin] - prevPrices[activeCoin]) / prevPrices[activeCoin]) * 100).toFixed(3)
                    : '0.000'}%
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="live-dot" />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Binance WS</span>
              <span style={{
                padding: '2px 8px', background: 'var(--blue-dim)', border: '1px solid rgba(0,180,255,0.2)',
                borderRadius: 4, fontSize: '0.65rem', color: 'var(--blue)', fontWeight: 700, marginLeft: 4,
              }}>4-AI ACTIVE</span>
            </div>
          </div>

          {/* Signal bar */}
          <div className="signal-bar">
            <div className={`signal-chip ${rlAgent.action.toLowerCase()}`}>
              <span className="signal-label">🎮 RL Signal</span>
              <span className="signal-value" style={{ color: rlAgent.action === 'BUY' ? 'var(--green)' : rlAgent.action === 'SELL' ? 'var(--red)' : 'var(--yellow)' }}>
                {rlAgent.action}
              </span>
            </div>
            <div className="signal-chip">
              <span className="signal-label">📰 Sentiment</span>
              <span className="signal-value" style={{ color: sentimentInfo.color }}>
                {sentimentInfo.label} ({sentimentIdx})
              </span>
            </div>
            <div className="signal-chip">
              <span className="signal-label">💸 Balance</span>
              <span className="signal-value" style={{ color: balance >= 10000 ? 'var(--green)' : 'var(--red)' }}>
                ${balance.toFixed(0)}
              </span>
            </div>
            <div className="signal-chip">
              <span className="signal-label">🧠 RF Conf</span>
              <span className="signal-value" style={{ color: aiConfidence > 60 ? 'var(--green)' : aiConfidence > 35 ? 'var(--yellow)' : 'var(--text-secondary)' }}>
                {aiConfidence}%
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="tab-content" key={activeTab}>
            {activeTab === 'chart'      && <LiveChart chartData={chartData} />}
            {activeTab === 'indicators' && <IndicatorsChart indicatorData={indicatorData} />}
            {activeTab === 'accuracy'   && <ForecastAccuracy forecastHistory={forecastHistory[activeCoin] || []} />}
            {activeTab === 'backtest'   && <BacktestPanel activeCoin={activeCoin} />}
            {activeTab === 'stats'      && <StatsPanel tradeLogs={tradeLogs} equityCurve={equityCurve} balance={balance} />}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <RightPanel
          newsData={newsData}
          rlAgent={rlAgent}
          balance={balance}
          position={position}
          tradeLogs={tradeLogs}
          prices={prices}
          activeCoin={activeCoin}
          historyData={chartData}
        />
      </div>
    </>
  );
}
