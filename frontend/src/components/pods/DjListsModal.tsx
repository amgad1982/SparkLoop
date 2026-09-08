import React from 'react';
import { DjDeckModal } from '../dj/DjDeckModal';

export interface DjListsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onStreamList?: any;
  activePodId?: string;
}

export const DjListsModal: React.FC<DjListsModalProps> = () => {
  return <DjDeckModal />;
};

export default DjListsModal;
