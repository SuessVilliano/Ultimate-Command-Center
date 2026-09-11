import React, { useEffect, useState } from 'react';
import ChatWidgetCore from './ChatWidgetCore';
import aiService from '../services/aiService';

export default function ChatWidget(props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    aiService.checkBackendConnection()
      .catch(() => false)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  if (!ready) return null;
  return <ChatWidgetCore {...props} />;
}
