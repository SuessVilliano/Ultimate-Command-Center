import React, { useEffect, useState } from 'react';
import AffiliateHubCore from './AffiliateHubCore';
import { API_URL } from '../../config';

export default function AffiliateHub(props) {
  const [aiServerStatus, setAiServerStatus] = useState('checking');

  useEffect(() => {
    let active = true;
    let timer = null;

    const checkBackend = async () => {
      try {
        const response = await fetch(`${API_URL}/health`, { cache: 'no-store' });
        if (active) setAiServerStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (active) setAiServerStatus('offline');
      }
    };

    checkBackend();
    timer = setInterval(checkBackend, 30000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return <AffiliateHubCore {...props} aiServerStatus={aiServerStatus} />;
}
