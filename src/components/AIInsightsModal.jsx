import React from 'react';

const AIInsightsModal = ({ isOpen, onClose, symbol, data, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content premium" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="ai-icon-pulse">🧠</div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Premium AI Insights</h3>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Deep Market Analysis · {symbol}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <div className="loader" style={{ margin: '0 auto 20px' }}></div>
              <div className="loading-text">ИИ сканирует рыночные аномалии...</div>
            </div>
          ) : data ? (
            <div className="report-container">
              {/* Summary Card */}
              <div className="report-summary-premium">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className={`recommendation-badge ${data.recommendation.toLowerCase()}`}>
                    {data.recommendation}
                  </div>
                  <div className="confidence-meter">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>CONFIDENCE:</span>
                    <span style={{ fontWeight: 800, color: 'var(--blue)', marginLeft: 6 }}>{data.confidence}%</span>
                  </div>
                </div>
                <p className="summary-text">{data.summary}</p>
              </div>

              {/* Reasoning Matrix Table */}
              <div className="section-title">Матрица обоснований</div>
              <div className="matrix-table">
                <div className="matrix-header">
                  <div>Фактор</div>
                  <div>Значение</div>
                  <div>Влияние</div>
                </div>
                {data.matrix?.map((item, i) => (
                  <div key={i} className="matrix-row">
                    <div className="factor-name">
                      {item.factor}
                      <span className="factor-reason">{item.reason}</span>
                    </div>
                    <div className="factor-value mono">{item.value}</div>
                    <div className={`factor-impact ${item.impact.toLowerCase()}`}>
                      {item.impact === 'BULL' ? '▲ POSITIVE' : (item.impact === 'BEAR' ? '▼ NEGATIVE' : '○ NEUTRAL')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Context Alert */}
              <div className="context-alert">
                <span style={{ marginRight: 8 }}>ℹ️</span>
                Данный отчет сформирован на основе Random Forest & NLP сентимента. Учитывается корреляция с BTC (30%) и локальные индикаторы (70%).
              </div>
            </div>
          ) : (
            <div className="empty-state">Ошибка получения данных. Проверьте соединение с бэкендом.</div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={onClose}>
            Понятно, в работу
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIInsightsModal;
