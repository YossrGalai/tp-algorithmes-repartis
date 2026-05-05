export const MESSAGE_TYPES = {
  ELECTION: 'ELECTION',
  COORDINATOR: 'COORDINATOR',
};

export const INITIAL_PROCESSES = [
  { id: 3, isActive: false, isLeader: false },
  { id: 1, isActive: false, isLeader: false },
  { id: 5, isActive: false, isLeader: false },
  { id: 2, isActive: false, isLeader: false },
  { id: 4, isActive: false, isLeader: false },
];

/**
 * Chang-Roberts Ring Election Logic
 * Returns the next state and side effects (logs, next message)
 */
export const handleMessage = (process, message) => {
  const { type, value } = message;
  const my_id = process.id;

  if (type === MESSAGE_TYPES.ELECTION) {
    if (value > my_id) {
      // Forward ELECTION(j)
      return {
        action: 'FORWARD',
        newValue: value,
        log: `P${my_id} transfère ELECTION(${value})`,
      };
    } else if (value < my_id) {
      // Replace and forward ELECTION(my_id)
      return {
        action: 'REPLACE',
        newValue: my_id,
        log: `P${my_id} remplace par ELECTION(${my_id})`,
      };
    } else {
      // value == my_id: This process is the winner
      return {
        action: 'WIN',
        newValue: my_id,
        log: `P${my_id} devient le LEADER`,
      };
    }
  } else if (type === MESSAGE_TYPES.COORDINATOR) {
    if (value === my_id) {
      // Finished propagation
      return {
        action: 'STOP',
        log: `P${my_id} a reçu COORDINATOR(${value}) - Propagation terminée`,
      };
    } else {
      // Store leader and forward
      return {
        action: 'FORWARD_COORDINATOR',
        newValue: value,
        log: `P${my_id} marque P${value} comme LEADER et transfère`,
      };
    }
  }

  return { action: 'NONE' };
};
