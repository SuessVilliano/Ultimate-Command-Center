import React from 'react';
import CommandTimeline from '../components/CommandTimeline';
import SyncAllButton from '../components/SyncAllButton';
import Dashboard from './Dashboard';

export default function CommandDashboard() {
  return (
    <div className="space-y-4">
      <SyncAllButton />
      <CommandTimeline />
      <Dashboard />
    </div>
  );
}
