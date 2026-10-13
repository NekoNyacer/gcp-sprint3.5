import { describe, expect, it } from 'vitest';
import { RELAY_TOPICS, RelayGroup, RelayPlayer, relayInitialState } from './relay-game.models';
import {
  actionForIndex,
  assignActivityTopics,
  appendFinalGuessPlayer,
  assignedBookId,
  canReviewRelayBook,
  canStartGroup,
  deferCurrentPlayer,
  durationForAction,
  shufflePlayers,
  turnEndsAtForAction,
} from './relay-game.rules';

const players: RelayPlayer[] = Array.from({ length: 6 }, (_, index) => ({
  uid: `p${index}`,
  displayName: `P${index}`,
  avatarSeed: `seed${index}`,
  avatarUrl: '',
  joinedAt: index,
}));

function group(overrides: Partial<RelayGroup> = {}): RelayGroup {
  return {
    id: 'g1',
    name: '第一組',
    status: 'waiting',
    players,
    turnOrder: players.map((player) => player.uid),
    topic: '',
    topicsByBook: {},
    currentTurnIndex: 0,
    currentRoundIndex: 0,
    roundSubmissions: [],
    turnEndsAt: null,
    remainingMs: null,
    forcedEnd: false,
    updatedAt: 0,
    ...overrides,
  };
}

describe('relay game rules', () => {
  it('creates relay rooms with unlimited drawing and guessing turns by default', () => {
    expect(relayInitialState.drawingSeconds).toBe(0);
    expect(relayInitialState.guessingSeconds).toBe(0);
  });

  it('alternates drawing and handwritten guessing', () => {
    expect(actionForIndex(0)).toBe('drawing');
    expect(actionForIndex(1)).toBe('guess');
    expect(actionForIndex(2)).toBe('drawing');
  });

  it('uses the shorter guessing timer', () => {
    expect(durationForAction('drawing', 75, 30)).toBe(75_000);
    expect(durationForAction('guess', 75, 30)).toBe(30_000);
  });

  it('uses no deadline for an unlimited action setting', () => {
    expect(turnEndsAtForAction(1_000, 'drawing', 0, 30)).toBeNull();
    expect(turnEndsAtForAction(1_000, 'guess', 75, 0)).toBeNull();
    expect(turnEndsAtForAction(1_000, 'drawing', 75, 30)).toBe(76_000);
  });

  it('keeps an expired activity task at the same position while moving that player to the end', () => {
    const order = ['p0', 'p1', 'p2', 'p3'];

    expect(deferCurrentPlayer(order, 1)).toEqual(['p0', 'p2', 'p3', 'p1']);
    expect(deferCurrentPlayer(order, 1)[1]).toBe('p2');
  });

  it('keeps the final player in place when there is no next player to take over', () => {
    expect(deferCurrentPlayer(['p0', 'p1'], 1)).toEqual(['p0', 'p1']);
  });

  it('keeps relay books hidden from players while the host is publicly revealing them', () => {
    expect(canReviewRelayBook('公開揭露', false)).toBe(false);
    expect(canReviewRelayBook('公開揭露', true)).toBe(true);
    expect(canReviewRelayBook('遊戲結束', false)).toBe(true);
  });

  it('assigns tabletop books by round and seat order', () => {
    expect(assignedBookId(group(), 'p2')).toBe('p2');
    expect(assignedBookId(group({ currentRoundIndex: 1 }), 'p2')).toBe('p1');
  });

  it('requires at least four players in either mode', () => {
    expect(canStartGroup(group(), 'activity')).toBe(true);
    expect(canStartGroup(group({ players: players.slice(0, 3) }), 'activity')).toBe(false);
    expect(canStartGroup(group({ players: players.slice(0, 3) }), 'tabletop')).toBe(false);
    expect(canStartGroup(group({ players: players.slice(0, 4) }), 'tabletop')).toBe(true);
  });

  it('adds a non-first player for an odd-sized activity group so the final page is a guess', () => {
    const order = ['p0', 'p1', 'p2', 'p3', 'p4'];
    const finalOrder = appendFinalGuessPlayer(order, () => 0.5);

    expect(finalOrder).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p3']);
    expect(finalOrder.at(-1)).not.toBe(order[0]);
    expect(actionForIndex(finalOrder.length - 1)).toBe('guess');
  });

  it('does not add a duplicate player when an activity group already ends on a guess', () => {
    expect(appendFinalGuessPlayer(['p0', 'p1', 'p2', 'p3'])).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('draws activity topics at game start instead of reusing a persisted group topic', () => {
    const legacyGroup: Pick<RelayGroup, 'id' | 'topic'> = { id: 'g1', topic: '雨傘' };
    const zeroDraw = assignActivityTopics([legacyGroup], () => 0)['g1'];
    const unchanged = assignActivityTopics([legacyGroup], () => 0.999_999)['g1'];

    expect(RELAY_TOPICS).toContain(zeroDraw);
    expect(RELAY_TOPICS).toContain(unchanged);
    expect(zeroDraw).toBe(RELAY_TOPICS[1]);
    expect(unchanged).toBe(RELAY_TOPICS[0]);
    expect(zeroDraw).not.toBe(unchanged);
  });

  it('shuffles without losing players', () => {
    const shuffled = shufflePlayers(players, () => 0);
    expect(shuffled.map((player) => player.uid).sort()).toEqual(
      players.map((player) => player.uid).sort(),
    );
  });
});
