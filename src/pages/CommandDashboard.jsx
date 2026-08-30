import React from 'react';
import CommandTimelineLive from '../components/CommandTimelineLive';
import SyncAllButton from '../components/SyncAllButton';
import ShortcutSetupCard from '../components/ShortcutSetupCard';
import Dashboard from './Dashboard';

export default function CommandDashboard() {
  return (
    <div className="space-y-4">
      <SyncAllButton />
      <ShortcutSetupCard />
      <CommandTimelineLive />
      <Dashboard />
    </div>
  );
}