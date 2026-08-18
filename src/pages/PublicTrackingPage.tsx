import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicTracking } from '../components/PublicTracking';
import { useTranslation } from '../hooks/useTranslation';
import { getHostingerDbData, subscribeToDbUpdates } from '../lib/db';

export const PublicTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { lang } = useTranslation();
  const [dbData, setDbData] = useState(() => getHostingerDbData());

  useEffect(() => {
    return subscribeToDbUpdates(() => {
      setDbData(getHostingerDbData());
    });
  }, []);

  return (
    <PublicTracking
      cartons={dbData.cartons}
      language={lang}
      onBackToPortal={() => navigate('/')}
    />
  );
};
