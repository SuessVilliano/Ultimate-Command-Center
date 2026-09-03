import React from 'react';
import HealthMetricsDashboard from '../components/HealthMetricsDashboard';
import TrainingTracker from '../components/TrainingTracker';
import HealthOS from './HealthOS';

export default function HealthCommandCenter() {
  return (
    <div className="space-y-6 max-w-7xl">
      <HealthMetricsDashboard />
      <TrainingTracker />
      <HealthOS />
    </div>
  );
}
