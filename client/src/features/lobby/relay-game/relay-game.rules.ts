import {
  RelayGroup,
  RelayMode,
  RelayPageKind,
  RelayPlayer,
  RelayRoomStatus,
  RELAY_TOPICS,
} from './relay-game.models';

export function shufflePlayers(players: RelayPlayer[], random = Math.random): RelayPlayer[] {
  const result = [...players];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function actionForIndex(index: number): Exclude<RelayPageKind, 'skipped'> {
  return index % 2 === 0 ? 'drawing' : 'guess';
}

export function durationForAction(
  action: Exclude<RelayPageKind, 'skipped'>,
  drawingSeconds: number,
  guessingSeconds: number,
): number {
  return (action === 'drawing' ? drawingSeconds : guessingSeconds) * 1_000;
}

/** A zero-second setting means the host, rather than a timer, ends the turn. */
export function turnEndsAtForAction(
  startedAt: number,
  action: Exclude<RelayPageKind, 'skipped'>,
  drawingSeconds: number,
  guessingSeconds: number,
): number | null {
  const duration = durationForAction(action, drawingSeconds, guessingSeconds);
  return duration > 0 ? startedAt + duration : null;
}

/**
 * Preserve the current task position while placing an inactive player last.
 * Keeping the index unchanged gives the following player the same draw/guess task.
 */
export function deferCurrentPlayer(turnOrder: string[], currentIndex: number): string[] {
  if (currentIndex < 0 || currentIndex >= turnOrder.length - 1) return [...turnOrder];
  const expiredPlayerUid = turnOrder[currentIndex];
  return [
    ...turnOrder.slice(0, currentIndex),
    ...turnOrder.slice(currentIndex + 1),
    expiredPlayerUid,
  ];
}

/**
 * Activity-mode relays alternate drawing and guessing from zero. An odd number
 * of players would otherwise end on drawing, so append one random non-first
 * player for a final handwritten guess.
 */
export function appendFinalGuessPlayer(
  turnOrder: string[],
  random = Math.random,
): string[] {
  if (turnOrder.length % 2 === 0 || turnOrder.length < 2) return [...turnOrder];
  const eligibleIndex =
    1 + Math.min(turnOrder.length - 2, Math.floor(random() * (turnOrder.length - 1)));
  return [...turnOrder, turnOrder[eligibleIndex]];
}

/** Assign one shuffled topic per activity group when the game starts. */
export function assignActivityTopics(
  groups: readonly Pick<RelayGroup, 'id'>[],
  random = Math.random,
): Record<string, string> {
  const topics = [...RELAY_TOPICS];
  for (let index = topics.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [topics[index], topics[target]] = [topics[target], topics[index]];
  }
  return Object.fromEntries(
    groups.map((group, index) => [group.id, topics[index % topics.length]]),
  );
}

export function assignedBookId(group: RelayGroup, playerUid: string): string | null {
  if (group.players.length === 0) return null;
  if (group.topicsByBook['activity']) return 'activity';
  const playerIndex = group.turnOrder.indexOf(playerUid);
  if (playerIndex < 0) return null;
  const ownerIndex =
    (playerIndex - group.currentRoundIndex + group.turnOrder.length) % group.turnOrder.length;
  return group.turnOrder[ownerIndex];
}

export function currentPlayerUid(group: RelayGroup, mode: RelayMode): string | null {
  if (mode === 'tabletop') return null;
  return group.turnOrder[group.currentTurnIndex] ?? null;
}

export function nextAction(group: RelayGroup, mode: RelayMode): Exclude<RelayPageKind, 'skipped'> {
  return actionForIndex(mode === 'activity' ? group.currentTurnIndex : group.currentRoundIndex);
}

export function canStartGroup(group: RelayGroup, mode: RelayMode): boolean {
  const minimum = 4;
  return group.players.length >= minimum && group.players.length <= 15;
}

export function canReviewRelayBook(status: RelayRoomStatus, isHost: boolean): boolean {
  return status === '遊戲結束' || (status === '公開揭露' && isHost);
}

export function isGroupCompleteAfterSubmission(
  group: RelayGroup,
  mode: RelayMode,
  submissionsAfterSubmit: number,
): boolean {
  if (mode === 'activity') return group.currentTurnIndex + 1 >= group.turnOrder.length;
  const roundCompletes = submissionsAfterSubmit >= group.turnOrder.length;
  return roundCompletes && group.currentRoundIndex + 1 >= group.turnOrder.length;
}
