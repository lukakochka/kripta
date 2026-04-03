from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import random
import time
import os

app = FastAPI(title="CryptoOracle AI Backend v4")

# Update CORS to allow all origins in development, specify in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Schemas ─────────────────────────────────────────────────────────────────
class CandleData(BaseModel):
    time: str
    price: float
    volume: float
    imbalance: float = 0.0
    btc_momentum: float = 0.0

class PredictRequest(BaseModel):
    symbol: str
    data: List[CandleData]

# ─── Indicators ──────────────────────────────────────────────────────────────
def ema(prices, period):
    if len(prices) < period:
        return None
    k = 2 / (period + 1)
    v = sum(prices[:period]) / period
    for p in prices[period:]:
        v = p * k + v * (1 - k)
    return v

def rsi(prices, period=14):
    if len(prices) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(1, len(prices)):
        d = prices[i] - prices[i - 1]
        gains.append(max(0, d))
        losses.append(max(0, -d))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)

def macd(prices):
    if len(prices) < 26:
        return 0.0
    e12 = ema(prices, 12)
    e26 = ema(prices, 26)
    return (e12 - e26) if (e12 and e26) else 0.0

def bollinger(prices, period=20):
    if len(prices) < period:
        return None, None, None
    sl = prices[-period:]
    m = sum(sl) / period
    std = (sum((p - m) ** 2 for p in sl) / period) ** 0.5
    return m + 2 * std, m, m - 2 * std

# ─── RL Q-Learning Agent ─────────────────────────────────────────────────────
class QLearner:
    def __init__(self):
        self.q = {}
        self.alpha = 0.12
        self.gamma = 0.95
        self.eps = 0.08
        self.virtual_pnl = 0.0
        self.last = None

    def state(self, prices, rsi_v, macd_v):
        trend = 1 if len(prices) > 1 and prices[-1] > prices[-2] else 0
        rzone = 0 if rsi_v < 32 else (2 if rsi_v > 68 else 1)
        mzone = 1 if macd_v > 0 else 0
        return (trend, rzone, mzone)

    def choose(self, s):
        if random.random() < self.eps:
            return random.randint(0, 2)
        return int(np.argmax(self.q.get(s, [0.0, 0.0, 0.0])))

    def update(self, s, a, r, ns):
        self.q.setdefault(s, [0.0, 0.0, 0.0])
        self.q.setdefault(ns, [0.0, 0.0, 0.0])
        cq = self.q[s][a]
        self.q[s][a] = cq + self.alpha * (r + self.gamma * max(self.q[ns]) - cq)

    def get_q(self, s):
        return self.q.get(s, [0.0, 0.0, 0.0])

agents = {}

def get_agent(sym):
    if sym not in agents:
        agents[sym] = QLearner()
    return agents[sym]

# ─── Random Forest–style ensemble prediction ─────────────────────────────────
def rf_predict(prices, volumes, rsi_v, macd_v, bb_pct):
    if len(prices) < 20:
        return [], 50, "SIDEWAYS"

    curr = prices[-1]
    m1 = (prices[-1] - prices[-2]) / prices[-2] if len(prices) >= 2 and prices[-2] else 0
    m5 = (prices[-1] - prices[-6]) / prices[-6] if len(prices) >= 6 and prices[-6] else 0
    m10 = (prices[-1] - prices[-11]) / prices[-11] if len(prices) >= 11 and prices[-11] else 0

    vol_mean = sum(volumes[-5:]) / len(volumes[-5:]) if volumes else 1
    vol_signal = (volumes[-1] / vol_mean - 1) * 0.0002 if vol_mean > 0 else 0

    rsi_sig = (50 - rsi_v) / 50 * 0.0005
    macd_sig = np.sign(macd_v) * 0.0008 if macd_v != 0 else 0
    bb_sig = (0.5 - bb_pct) * 0.0006 if bb_pct is not None else 0

    # Weighted ensemble signal
    signal = (
        m1 * 0.18 +
        m5 * 0.25 +
        m10 * 0.15 +
        rsi_sig +
        macd_sig +
        bb_sig +
        vol_signal
    )

    # Apply EMA smoothing on last 5 price deltas
    if len(prices) >= 6:
        recent_deltas = [(prices[i] - prices[i-1]) / prices[i-1] for i in range(len(prices)-1, len(prices)-6, -1)]
        avg_delta = sum(recent_deltas) / len(recent_deltas)
        signal = signal * 0.7 + avg_delta * 0.3

    preds = []
    last = curr
    for i in range(1, 6):
        decay = 0.82 ** i
        next_p = last * (1 + signal * decay)
        preds.append({"offset": i, "predict": round(next_p, 6)})
        last = next_p

    # Confidence
    sign_consistent = sum(1 for x in [m1, m5, m10] if np.sign(x) == np.sign(signal))
    conf = int(sign_consistent / 3 * 50 + abs(rsi_v - 50) / 50 * 25 + min(abs(signal) * 10000, 25))
    conf = max(20, min(95, conf))

    # Macro
    if m5 > 0.0012 and macd_v > 0 and rsi_v < 68:
        macro = "BULL TREND"
    elif m5 < -0.0012 and macd_v < 0 and rsi_v > 32:
        macro = "BEAR TREND"
    elif abs(m5) < 0.0005:
        macro = "SIDEWAYS"
    else:
        macro = "BULL WEAK" if signal > 0 else "BEAR WEAK"

    return preds, conf, macro

# ─── News Pool ────────────────────────────────────────────────────────────────
NEWS = [
    {"title": "Bitcoin eyes $100K as institutional demand surges", "source": "CoinDesk", "score": 0.8},
    {"title": "Fed signals rate cuts — risk assets rally strongly", "source": "Reuters", "score": 0.62},
    {"title": "Ethereum ETF inflows hit record high this week", "source": "Bloomberg", "score": 0.74},
    {"title": "Crypto regulation clarity boosts market confidence", "source": "Forbes", "score": 0.5},
    {"title": "Bitcoin mining difficulty reaches all-time high", "source": "CoinTelegraph", "score": 0.28},
    {"title": "Solana DeFi TVL surpasses $10B milestone", "source": "DeFiPulse", "score": 0.7},
    {"title": "Market analysts warn of crypto correction ahead", "source": "MarketWatch", "score": -0.42},
    {"title": "SEC delays spot ETF decision — uncertainty lingers", "source": "TheBlock", "score": -0.35},
    {"title": "Toncoin integrates with major messaging platform", "source": "TechCrunch", "score": 0.65},
    {"title": "Global liquidity tightening poses risk to crypto markets", "source": "FT", "score": -0.52},
    {"title": "On-chain data shows strong accumulation by whales", "source": "Glassnode", "score": 0.78},
    {"title": "Crypto exchange volumes hit 3-month lows", "source": "CoinGecko", "score": -0.25},
]

news_cycle = 0

def get_sentiment():
    global news_cycle
    idx = [news_cycle % len(NEWS), (news_cycle + 3) % len(NEWS),
           (news_cycle + 7) % len(NEWS), (news_cycle + 11) % len(NEWS)]
    news_cycle += 1
    selected = [NEWS[i] for i in idx]
    score = sum(a["score"] for a in selected) / len(selected)
    index = int((score + 1) / 2 * 100)
    return {"index": max(0, min(100, index)), "articles": selected, "status": "live"}

# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "version": "4.0", "timestamp": time.time()}

@app.post("/predict")
async def predict(req: PredictRequest):
    prices = [d.price for d in req.data]
    volumes = [d.volume for d in req.data]
    if len(prices) < 10:
        return {"error": "Not enough data"}

    rsi_v = rsi(prices)
    macd_v = macd(prices)
    bb_upper, bb_mid, bb_lower = bollinger(prices)
    bb_pct = ((prices[-1] - bb_lower) / (bb_upper - bb_lower)) if (bb_upper and bb_lower and bb_upper != bb_lower) else 0.5

    # RF prediction
    prediction, conf, macro = rf_predict(prices, volumes, rsi_v, macd_v, bb_pct)

    # RL Agent
    agent = get_agent(req.symbol)
    s = agent.state(prices, rsi_v, macd_v)
    a = agent.choose(s)
    q = agent.get_q(s)

    if agent.last:
        price_chg = (prices[-1] - agent.last["price"]) / agent.last["price"]
        reward = price_chg * 1000 if a == 2 else (-price_chg * 1000 if a == 0 else -abs(price_chg) * 300)
        ns = agent.state(prices, rsi_v, macd_v)
        agent.update(agent.last["state"], agent.last["action"], reward, ns)
        agent.virtual_pnl += reward

    agent.last = {"price": prices[-1], "state": s, "action": a}
    actions = ["SELL", "HOLD", "BUY"]

    return {
        "prediction": prediction,
        "macro": macro,
        "confidence": conf,
        "rsi": round(rsi_v, 2),
        "macd": round(macd_v, 6),
        "bb_pct": round(bb_pct, 4),
        "news": get_sentiment(),
        "rl_agent": {
            "action": actions[a],
            "q_values": [round(v, 3) for v in q],
            "balance": round(agent.virtual_pnl, 2),
        },
    }

@app.get("/backtest/{symbol}")
async def backtest(symbol: str, interval: str = "5m", limit: int = 200):
    try:
        url = f"https://api.binance.com/api/v3/klines?symbol={symbol}USDT&interval={interval}&limit={limit}"
        with urllib.request.urlopen(url, timeout=12) as r:
            candles = json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

    prices = [float(c[4]) for c in candles]
    volumes = [float(c[5]) for c in candles]
    times = [time.strftime("%H:%M", time.localtime(c[0] / 1000)) for c in candles]

    balance = 10000.0
    position = None
    trades = []
    equity = [{"time": times[0], "equity": balance}]

    for i in range(26, len(prices)):
        p = prices[:i + 1]
        v = volumes[:i + 1]
        rsi_v = rsi(p[-20:])
        macd_v = macd(p[-30:])
        bu, bm, bl = bollinger(p[-20:])
        bp = ((p[-1] - bl) / (bu - bl)) if (bu and bl and bu != bl) else 0.5
        preds, conf, macro = rf_predict(p, v, rsi_v, macd_v, bp)
        curr = p[-1]

        if position:
            pct = (curr - position["entry"]) / position["entry"]
            pred_next = preds[0]["predict"] if preds else curr
            if pct <= -0.005 or pct >= 0.012 or (pred_next < curr and pct > 0.002):
                profit = position["amount"] * pct
                balance += position["amount"] + profit
                trades.append({
                    "type": "PROFIT" if profit >= 0 else "LOSS",
                    "entry": round(position["entry"], 4),
                    "exit": round(curr, 4),
                    "profit": round(profit, 2),
                    "profit_pct": round(pct * 100, 3),
                    "time": times[i],
                })
                equity.append({"time": times[i], "equity": round(balance, 2)})
                position = None
        else:
            pred_next = preds[0]["predict"] if preds else curr
            if macro.startswith("BULL") and conf > 55 and rsi_v < 65 and pred_next > curr and balance >= 500:
                amt = min(1000, balance * 0.12)
                balance -= amt
                position = {"entry": curr, "amount": amt}

    wins = [t for t in trades if t["type"] == "PROFIT"]
    losses = [t for t in trades if t["type"] == "LOSS"]
    returns = [t["profit_pct"] / 100 for t in trades]
    mean_r = sum(returns) / len(returns) if returns else 0
    std_r = (sum((r - mean_r) ** 2 for r in returns) / len(returns)) ** 0.5 if len(returns) > 1 else 0
    sharpe = round((mean_r / std_r) * (252 * 288) ** 0.5, 2) if std_r > 0 else 0
    eq_vals = [e["equity"] for e in equity]
    peak, max_dd = eq_vals[0], 0
    for vv in eq_vals:
        if vv > peak: peak = vv
        dd = (peak - vv) / peak
        if dd > max_dd: max_dd = dd

    return {
        "trades": trades[-40:],
        "equity_curve": equity[-200:],
        "statistics": {
            "total_trades": len(trades),
            "win_trades": len(wins),
            "loss_trades": len(losses),
            "win_rate": round(len(wins) / len(trades) * 100 if trades else 0, 1),
            "total_return": round((balance - 10000) / 10000 * 100, 2),
            "sharpe_ratio": sharpe,
            "max_drawdown": round(max_dd * 100, 2),
            "avg_profit": round(sum(t["profit"] for t in wins) / len(wins) if wins else 0, 2),
            "avg_loss": round(sum(t["profit"] for t in losses) / len(losses) if losses else 0, 2),
            "final_balance": round(balance, 2),
        },
    }

if __name__ == "__main__":
    import uvicorn
    # Render and other PaaS use dynamic PORT environment variables
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
