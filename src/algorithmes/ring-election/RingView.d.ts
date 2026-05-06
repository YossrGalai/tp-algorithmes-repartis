import type { JSX } from 'react';
import type { ProcessState } from './election';

export type MessagePosition = {
  x: number;
  y: number;
};

export type RingViewProps = {
  processes: ProcessState[];
  activeId: number | null;
  leaderId: number | null;
  messagePos: MessagePosition | null;
  ringSize: number;
  onInitiateElection?: (id: number) => void;
  isSimulating?: boolean;
};

declare function RingView(props: RingViewProps): JSX.Element;

export default RingView;
