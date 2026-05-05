import type { ProcessNode, Message, Event, AlgorithmState } from '../types/index';

let messageCounter = 0;
let eventCounter = 0;

const createMessage = (
  type: Message['type'],
  from: number,
  to: number,
  clock: number
): Message => ({
  id: `msg-${++messageCounter}`,
  type,
  from,
  to,
  timestamp: Date.now(),
  clock,
  status: 'sending',
});

const createEvent = (
  processId: number,
  type: Event['type'],
  description: string,
  clock: number,
  time: number
): Event => ({
  id: `evt-${++eventCounter}`,
  time,
  processId,
  type,
  description,
  clock,
});

export const initializeState = (): AlgorithmState => ({
  processes: [0, 1, 2].map((id) => ({
    id,
    state: 'IDLE',
    clock: 0,
    requestClock: null,
    repliesReceived: [],
    deferredReplies: [],
    inCS: false,
    failed: false,
  })),
  messages: [],
  events: [],
  step: 0,
  isRunning: false,
  speed: 1,
});

const tickClock = (process: ProcessNode, receivedClock?: number): number => {
  if (receivedClock !== undefined) {
    return Math.max(process.clock, receivedClock) + 1;
  }
  return process.clock + 1;
};

export const requestCS = (
  state: AlgorithmState,
  processId: number
): AlgorithmState => {
  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const process = processes[processId];

  if (process.state !== 'IDLE' || process.failed) return state;

  const newClock = tickClock(process);
  process.clock = newClock;
  process.state = 'WANTING';
  process.requestClock = newClock;
  process.repliesReceived = [];

  const newMessages: Message[] = [];
  const newEvents: Event[] = [
    createEvent(
      processId,
      'REQUEST_SENT',
      `P${processId} envoie REQUEST(${newClock}) à tous les autres processus`,
      newClock,
      state.step
    ),
  ];

  processes.forEach((p) => {
    if (p.id !== processId && !p.failed) {
      const msg = createMessage('REQUEST', processId, p.id, newClock);
      newMessages.push(msg);
    }
  });

  return {
    ...state,
    processes,
    messages: [...state.messages, ...newMessages],
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const receiveRequest = (
  state: AlgorithmState,
  messageId: string
): AlgorithmState => {
  const message = state.messages.find((m) => m.id === messageId);
  if (!message || message.type !== 'REQUEST' || message.status === 'delivered') return state;

  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const receiver = processes[message.to];
  //const sender = processes[message.from];

  if (receiver.failed) return state;

  const newClock = tickClock(receiver, message.clock);
  receiver.clock = newClock;

  const newMessages: Message[] = [];
  const newEvents: Event[] = [];

  const shouldDefer =
    receiver.state === 'IN_CS' ||
    (receiver.state === 'WANTING' &&
      receiver.requestClock !== null &&
      (receiver.requestClock < message.clock ||
        (receiver.requestClock === message.clock && receiver.id < message.from)));

  if (shouldDefer) {
    receiver.deferredReplies.push(message.from);
    newEvents.push(
      createEvent(
        receiver.id,
        'DEFERRED',
        `P${receiver.id} diffère la réponse à P${message.from} (priorité à P${receiver.id})`,
        newClock,
        state.step
      )
    );
  } else {
    const reply = createMessage('REPLY', receiver.id, message.from, newClock);
    newMessages.push(reply);
    newEvents.push(
      createEvent(
        receiver.id,
        'REPLY_SENT',
        `P${receiver.id} envoie REPLY à P${message.from}`,
        newClock,
        state.step
      )
    );
  }

  const updatedMessages = state.messages.map((m) =>
    m.id === messageId ? { ...m, status: 'delivered' as const } : m
  );

  return {
    ...state,
    processes,
    messages: [...updatedMessages, ...newMessages],
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const receiveReply = (
  state: AlgorithmState,
  messageId: string
): AlgorithmState => {
  const message = state.messages.find((m) => m.id === messageId);
  if (!message || message.type !== 'REPLY' || message.status === 'delivered') return state;

  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const receiver = processes[message.to];

  if (receiver.failed || receiver.state !== 'WANTING') return state;

  const newClock = tickClock(receiver, message.clock);
  receiver.clock = newClock;
  receiver.repliesReceived.push(message.from);

  const newEvents: Event[] = [
    createEvent(
      receiver.id,
      'REPLY_RECEIVED',
      `P${receiver.id} reçoit REPLY de P${message.from} (${receiver.repliesReceived.length}/2 réponses)`,
      newClock,
      state.step
    ),
  ];

  const activeProcesses = processes.filter((p) => !p.failed && p.id !== receiver.id);
  const allReplied = activeProcesses.every((p) =>
    receiver.repliesReceived.includes(p.id)
  );

  if (allReplied) {
    receiver.state = 'IN_CS';
    receiver.inCS = true;
    newEvents.push(
      createEvent(
        receiver.id,
        'ENTERED_CS',
        `P${receiver.id} entre en SECTION CRITIQUE ✓ (toutes les réponses reçues)`,
        newClock,
        state.step
      )
    );
  }

  const updatedMessages = state.messages.map((m) =>
    m.id === messageId ? { ...m, status: 'delivered' as const } : m
  );

  return {
    ...state,
    processes,
    messages: [...updatedMessages],
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const exitCS = (
  state: AlgorithmState,
  processId: number
): AlgorithmState => {
  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const process = processes[processId];

  if (process.state !== 'IN_CS') return state;

  const newClock = tickClock(process);
  process.clock = newClock;
  process.state = 'IDLE';
  process.inCS = false;
  process.requestClock = null;

  const newMessages: Message[] = [];
  const newEvents: Event[] = [
    createEvent(
      processId,
      'EXITED_CS',
      `P${processId} quitte la section critique et envoie les réponses différées`,
      newClock,
      state.step
    ),
  ];

  const deferred = [...process.deferredReplies];
  process.deferredReplies = [];

  deferred.forEach((targetId) => {
    if (!processes[targetId].failed) {
      const reply = createMessage('REPLY', processId, targetId, newClock);
      newMessages.push(reply);
      newEvents.push(
        createEvent(
          processId,
          'REPLY_SENT',
          `P${processId} envoie REPLY différé à P${targetId}`,
          newClock,
          state.step
        )
      );
    }
  });

  return {
    ...state,
    processes,
    messages: [...state.messages, ...newMessages],
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const failProcess = (
  state: AlgorithmState,
  processId: number
): AlgorithmState => {
  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const process = processes[processId];

  process.failed = true;
  process.state = 'FAILED';

  const newEvents: Event[] = [
    createEvent(
      processId,
      'FAILED',
      `⚠ P${processId} est en PANNE - impact sur le système`,
      process.clock,
      state.step
    ),
  ];

  return {
    ...state,
    processes,
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const recoverProcess = (
  state: AlgorithmState,
  processId: number
): AlgorithmState => {
  const processes = state.processes.map((p) => ({ ...p, deferredReplies: [...p.deferredReplies], repliesReceived: [...p.repliesReceived] }));
  const process = processes[processId];

  process.failed = false;
  process.state = 'IDLE';
  process.requestClock = null;
  process.repliesReceived = [];
  process.deferredReplies = [];

  const newEvents: Event[] = [
    createEvent(
      processId,
      'RECOVERED',
      `P${processId} est rétabli`,
      process.clock,
      state.step
    ),
  ];

  return {
    ...state,
    processes,
    events: [...state.events, ...newEvents],
    step: state.step + 1,
  };
};

export const getPendingMessages = (state: AlgorithmState): Message[] =>
  state.messages.filter((m) => m.status === 'sending');