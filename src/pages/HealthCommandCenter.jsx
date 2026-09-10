import React from 'react';
import { Activity, ClipboardList, Dumbbell } from 'lucide-react';
import HealthMetricsDashboard from '../components/HealthMetricsDashboard';
import TrainingTracker from '../components/TrainingTracker';
import WorkoutPlanManager from '../components/WorkoutPlanManager';
import PersistentPanel from '../components/PersistentPanel';
import HealthOS from './HealthOS';

export default function HealthCommandCenter() {
  return (
    <div className="space-y-4 max-w-7xl">
      <PersistentPanel id="health-live-intelligence" title="Live Health Intelligence" subtitle="Oura + Apple Health metrics" icon={Activity} defaultOpen>
        <HealthMetricsDashboard />
      </PersistentPanel>
      <PersistentPanel id="health-workout-plans" title="Workout Plan Builder" subtitle="Named routines, sets, reps, max/load and revisions" icon={Dumbbell} defaultOpen>
        <WorkoutPlanManager />
      </PersistentPanel>
      <PersistentPanel id="health-training-log" title="Training Log" subtitle="Strength sessions, bike rides and progress" icon={Dumbbell} defaultOpen={false}>
        <TrainingTracker />
      </PersistentPanel>
      <PersistentPanel id="health-plan" title="Health OS Plan" subtitle="Targets, labs and recomposition plan" icon={ClipboardList} defaultOpen={false}>
        <HealthOS />
      </PersistentPanel>
    </div>
  );
}
