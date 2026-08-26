import React from 'react';
import { AuthModal } from '../auth/AuthModal';

interface PersonaSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'switch' | 'register';
}

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ isOpen }) => {
  if (!isOpen) return null;
  return <AuthModal />;
};
