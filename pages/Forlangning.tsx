import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy /forlangning route — redirects to the consolidated /checkout page.
 * Keeps all old email links and bookmarks working.
 */
export const Forlangning: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/checkout?flow=renewal', { replace: true });
  }, [navigate]);

  return null;
};

export default Forlangning;
