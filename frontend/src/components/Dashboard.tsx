import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { HistoryEntry, RiskTier } from '../types';

interface Props {
  history: HistoryEntry[];
}

const TIER_COLORS: Record<RiskTier, string> = {
  low:    '#22c55e',
  medium: '#f59e0b',
  high:   '#ef4444',
};

export function Dashboard({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="dashboard-empty card">
        <p>No data yet — score a PR to see analytics here.</p>
      </div>
    );
  }

  // Pie data — tier distribution
  const counts: Record<RiskTier, number> = { low: 0, medium: 0, high: 0 };
  history.forEach((h) => counts[h.result.risk_tier]++);
  const pieData = (['low', 'medium', 'high'] as RiskTier[])
    .filter((t) => counts[t] > 0)
    .map((t) => ({ name: t.charAt(0).toUpperCase() + t.slice(1), value: counts[t], tier: t }));

  // Bar data — score per PR (last 10)
  const barData = history.slice(-10).map((h) => ({
    pr: h.pr_id,
    score: Math.round(h.result.risk_score * 100),
    tier: h.result.risk_tier,
  }));

  return (
    <div className="dashboard">
      <h2 className="section-title">Analytics</h2>
      <div className="charts-grid">
        <div className="card chart-card">
          <h3>Risk Tier Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                {pieData.map((entry) => (
                  <Cell key={entry.tier} fill={TIER_COLORS[entry.tier]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3>Risk Score per PR</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="pr" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={TIER_COLORS[entry.tier]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card stats-row">
        <div className="stat">
          <span className="stat-val">{history.length}</span>
          <span className="stat-lbl">PRs Scored</span>
        </div>
        <div className="stat">
          <span className="stat-val tier-high">{counts.high}</span>
          <span className="stat-lbl">High Risk</span>
        </div>
        <div className="stat">
          <span className="stat-val tier-medium">{counts.medium}</span>
          <span className="stat-lbl">Medium Risk</span>
        </div>
        <div className="stat">
          <span className="stat-val tier-low">{counts.low}</span>
          <span className="stat-lbl">Low Risk</span>
        </div>
        <div className="stat">
          <span className="stat-val">
            {Math.round(history.reduce((s, h) => s + h.result.risk_score, 0) / history.length * 100)}%
          </span>
          <span className="stat-lbl">Avg Score</span>
        </div>
      </div>
    </div>
  );
}
