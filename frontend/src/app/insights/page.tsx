'use client';

import LiveInsightsFeed from '@/components/dashboard/LiveInsightsFeed';
import SalaryEstimatorCard from '@/components/dashboard/SalaryEstimatorCard';
import SkillGapDashboard from '@/components/dashboard/SkillGapDashboard';

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Market Intelligence</h1>
        <p className="mt-2 text-gray-500">
          Real-time AI-powered insights, salary predictions, and skill gap analysis
          based on live job market data.
        </p>
      </div>

      {/* Live Insights */}
      <LiveInsightsFeed />

      {/* Salary Estimator */}
      <SalaryEstimatorCard />

      {/* Market Skill Gap */}
      <SkillGapDashboard />
    </div>
  );
}
