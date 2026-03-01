'use client';

/**
 * Market Intel panel — live insights, salary estimator, market skill gap (from /insights page).
 */

import LiveInsightsFeed from '@/components/dashboard/LiveInsightsFeed';
import SalaryEstimatorCard from '@/components/dashboard/SalaryEstimatorCard';
import SkillGapDashboard from '@/components/dashboard/SkillGapDashboard';

export default function InsightsPanel() {
  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Market Intelligence</h1>
        <p className="mt-1 text-sm text-gray-500">
          Real-time AI-powered insights, salary predictions, and skill gap analysis from live market data.
        </p>
      </div>

      <LiveInsightsFeed />
      <SalaryEstimatorCard />
      <SkillGapDashboard />
    </div>
  );
}
