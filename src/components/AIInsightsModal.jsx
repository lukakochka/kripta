import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function AIInsightsModal({ isOpen, onClose, symbol, data }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && symbol && data?.length) {
      generateReport();
    }
  }, [isOpen, symbol]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        symbol,
        data: data.slice(-40).map(d => ({
          time: d.time,
          price: d.price,
          volume: d.volume || 0,
          imbalance: d.imbalance || 0,
          btc_momentum: d.btc_momentum || 0
        }))
      };

      const res = await fetch(`${API_BASE}/analyze/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setReport(result);
    } catch (err) {
      setError('Не удалось получить отчет от ИИ. Проверьте соединение с сервером.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ai-icon-pulse">🧠</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>Глубокий анализ: {symbol}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CryptoOracle PRO Analysis Engine v4.0</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div className="loader" style={{ margin: '0 auto 15px' }}></div>
              <div style={{ color: 'var(--blue)', fontWeight: 600 }}>ИИ анализирует рынок...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--red)' }}>
              ⚠️ {error}
            </div>
          ) : report ? (
            <div className="report-container">
              <div className="report-summary">
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 5 }}>Заключение ИИ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--blue)' }}>{report.summary}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
                <div className="report-card">
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Рекомендация</div>
                  <div style={{ 
                    fontSize: '1.5rem', fontWeight: 900, 
                    color: report.recommendation === 'BUY' ? 'var(--green)' : report.recommendation === 'SELL' ? 'var(--red)' : 'var(--yellow)' 
                  }}>
                    {report.recommendation}
                  </div>
                </div>
                <div className="report-card">
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Уверенность</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--blue)' }}>
                    {report.confidence}%
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                   📊 Ключевые факторы анализа:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {report.factors.map((f, i) => (
                    <div key={i} style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      padding: '10px 14px', 
                      borderRadius: 6, 
                      fontSize: '0.82rem',
                      borderLeft: '3px solid var(--blue)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}>
                      <span style={{ color: 'var(--blue)' }}>●</span> {f}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ 
                background: 'rgba(0,180,255,0.05)', 
                border: '1px solid rgba(0,180,255,0.2)', 
                borderRadius: 8, 
                padding: '12px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                <strong>Примечание:</strong> ИИ проанализировал RSI, MACD, Полосы Боллинджера и текущую структуру BTC-Momentum. Данный отчет носит информационный характер и не является финансовой рекомендацией.
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>Понятно, спасибо</button>
        </div>
      </div>
    </div>
  );
}
