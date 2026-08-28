import React from 'react';
import CommandTimeline from '../components/CommandTimeline';
import Dashboard from './Dashboard';

export default function CommandDashboard() {
  return (
    <div>
      <CommandTimeline />
      <Dashboard />
    </div>
  );
}
