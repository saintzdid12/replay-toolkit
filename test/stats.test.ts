import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeReplay, readRound, summarizeRound } from '../src/stats.ts';
import { fetchReplayStats } from '../src/api-fortnite.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/round.json', import.meta.url), 'utf8'));

test('aggregates the four-game fixture and counts metric coverage', () => {
  const report = summarizeRound(readRound(fixture), ['rook']);
  assert.deepEqual(report.coverage, { expected: 4, analyzed: 4, missingMatchIds: [] });
  const [rook] = report.players;
  assert.deepEqual(rook.games.map(game => game.placement), [8, 2, 12, 1]);
  assert.deepEqual(rook.totals.kills, { value: 14, games: 4 });
  assert.deepEqual(rook.totals.stormDamageTaken, { value: 15, games: 3 });
  assert.deepEqual(rook.headshotRate, { value: 14 / 88, numerator: 14, denominator: 88, games: 4 });
});

test('deduplicates matches and pairs only available inputs for ratios', () => {
  const first = normalizeReplay('GAME-1', { game: { players: {
    a: { playerId: 'A', displayName: 'Before', headshots: 0, hitsToPlayers: 4, damageToPlayers: 0 }
  } } });
  const second = normalizeReplay('game-2', { game: { players: [
    { playerId: 'a', displayName: 'After', headshots: 10, hitsToPlayers: null, damageToPlayers: 30, damageTaken: 0 }
  ] } });
  const report = summarizeRound({
    matchIds: ['game-1', 'game-2', 'game-3', 'GAME-1'],
    matches: [second, first, first]
  }, ['A', 'missing']);
  assert.deepEqual(report.coverage, { expected: 3, analyzed: 2, missingMatchIds: ['game-3'] });
  const [player, missing] = report.players;
  assert.equal(player.name, 'After');
  assert.deepEqual(player.headshotRate, { value: 0, numerator: 0, denominator: 4, games: 1 });
  assert.equal(player.damageRatio.value, null);
  assert.deepEqual(missing.totals.kills, { value: null, games: 0 });
});

test('rejects corrupt and out-of-round data', () => {
  assert.throws(() => readRound({ matchIds: ['a'], replays: [{}] }), /Match ID/);
  assert.throws(() => summarizeRound({ matchIds: ['other'], matches: readRound(fixture).matches }), /outside this round/);
});

test('adapter uses the stats-only endpoint and requires explicit opt-in', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(fixture.replays[0]));
  // Reflect.apply exercises the runtime guard for JavaScript callers.
  await assert.rejects(Reflect.apply(fetchReplayStats, null, ['demo-1', { apiKey: 'fake' }]), /explicit approval/);
  assert.equal(mock.mock.callCount(), 0);
  const replay = await fetchReplayStats('demo-1', { apiKey: 'fake', spendCredit: true });
  assert.equal(replay.players.length, 3);
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(mock.mock.calls[0].arguments[0], 'https://prod.api-fortnite.com/api/v1/replays/demo-1/parse/stats');
});

