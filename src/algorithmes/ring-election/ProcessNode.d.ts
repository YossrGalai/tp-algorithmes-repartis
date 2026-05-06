import type { CSSProperties, JSX } from 'react';

export type ProcessNodeProps = {
  id: number;
  isActive: boolean;
  isLeader: boolean;
  isFailed: boolean;
  angle: number;
  ringSize: number;
  style: CSSProperties;
};

declare function ProcessNode(props: ProcessNodeProps): JSX.Element;

export default ProcessNode;
