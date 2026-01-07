import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auth disabled - redirect directly to dashboard
    navigate('/dashboard');
  }, [navigate]);

  return null;
};

export default Index;