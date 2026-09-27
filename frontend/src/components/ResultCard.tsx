import React from 'react';
import { AlertTriangle, CheckCircle, Info, FileCode, GitPullRequest, AlertCircle } from 'lucide-react';
import type { ScoreResponse, RiskTier } from '../types';

interface Props {
  prId: string;
  result: ScoreResponse;
}

const tierMeta: Record<RiskTier, { label: string; icon: React.ReactNode; className: string }> = {
  low:    { label: 'Low Risk',    icon: <CheckCircle size={18} />,   className: 'tier-low' },
  medium: { label: 'Medium Risk', icon: <Info size={18} />,          className: 'tier-medium' },
  high:   { label: 'High Risk',   icon: <AlertTriangle size={18} />, className: 'tier-high' },
};

export function ResultCard({ prId, result }: Props) {
  const meta = tierMeta[result.risk_tier];
  const pct = Math.round(result.risk_score * 100);

  return (
    <div className={`result-card card ${meta.className}`}>
      <div className="result-header">
        <span className="pr-label">
          <GitPullRequest size={15} /> {prId}
        </span>
        <span className={`tier-badge ${meta.className}`}>
          {meta.icon} {meta.label}
        </span>
      </div>

      <div className="score-gauge">
        <div className="gauge-track">
          <div
            className={`gauge-fill ${meta.className}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="gauge-label">{pct}%</span>
      </div>

      {result.driving_files.length > 0 && (
        <div className="result-section">
          <h4><FileCode size={14} /> Driving Files</h4>
          <ul>
            {result.driving_files.map((f) => (
              <li key={f} className="mono">{f}</li>
            ))}
          </ul>
        </div>
      )}

      {result.driving_reasons.length > 0 && (
        <div className="result-section">
          <h4><AlertCircle size={14} /> Risk Reasons</h4>
          <ul>
            {result.driving_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.related_incidents.length > 0 && (
        <div className="result-section">
          <h4>Related Incidents</h4>
          <div className="incident-chips">
            {result.related_incidents.map((id) => (
              <span key={id} className="chip">{id}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
