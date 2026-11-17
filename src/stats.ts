export const metrics = [
  'kills', 'damageToPlayers', 'damageTaken', 'headshots', 'hitsToPlayers',
  'shots', 'buildsPlaced', 'buildsDestroyed', 'editCount', 'stormDamageTaken',
  'timeInStorm', 'timeAlive'
] as const;

export type Metric = typeof metrics[number];
export type Player = {
  id: string;
  name: string;
  placement: number | null;
  stats: Partial<Record<Metric, number>>;
};
export type Match = { id: string; players: Player[] };
export type Round = { matchIds: string[]; matches: Match[] };

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object.');
  }
  return value as Record<string, unknown>;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,160}$/i.test(value)) {
    throw new Error(label + ' must be a nonempty identifier.');
  }
  return value.toLowerCase();
}

export function normalizeReplay(matchId: string, payload: unknown): Match {
  const game = record(record(payload, 'Replay').game, 'Replay game');
  const source = Array.isArray(game.players) ? game.players : Object.values(record(game.players, 'Replay players'));
  if (!source.length) throw new Error('Replay contains no per-player stats.');

  const seen = new Set<string>();
  const players = source.map(value => {
    const row = record(value, 'Player');
    const id = identifier(row.playerId, 'Player ID');
    if (seen.has(id)) throw new Error('Duplicate player in replay: ' + id);
    seen.add(id);
    const stats: Player['stats'] = {};
    for (const metric of metrics) {
      const value = row[metric];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) stats[metric] = value;
    }
    return {
      id,
      name: typeof row.displayName === 'string' && row.displayName.trim() ? row.displayName : id,
      placement: typeof row.placement === 'number' && Number.isInteger(row.placement) && row.placement > 0
        ? row.placement : null,
      stats
    };
  });
  return { id: identifier(matchId, 'Match ID'), players };
}

export function readRound(value: unknown): Round {
  const input = record(value, 'Round');
  if (!Array.isArray(input.matchIds) || !input.matchIds.length || !Array.isArray(input.replays)) {
    throw new Error('Round input requires a nonempty matchIds array and a replays array.');
  }
  return {
    matchIds: input.matchIds.map(value => identifier(value, 'Match ID')),
    matches: input.replays.map(value => {
      const row = record(value, 'Round replay');
      return normalizeReplay(identifier(row.matchId, 'Match ID'), row);
    })
  };
}

function ratio(games: Player[], numerator: Metric, denominator: Metric) {
  let pairedGames = 0;
  let top = 0;
  let bottom = 0;
  for (const game of games) {
    const a = game.stats[numerator];
    const b = game.stats[denominator];
    if (a === undefined || b === undefined) continue;
    pairedGames++;
    top += a;
    bottom += b;
  }
  return { value: bottom > 0 ? top / bottom : null, numerator: top, denominator: bottom, games: pairedGames };
}

export function summarizeRound(round: Round, playerIds?: string[]) {
  const expected = new Set(round.matchIds.map(id => identifier(id, 'Match ID')));
  const byMatch = new Map<string, Match>();
  for (const match of round.matches) {
    if (!expected.has(match.id)) throw new Error('Replay is outside this round: ' + match.id);
    if (!byMatch.has(match.id)) byMatch.set(match.id, match);
  }
  const byPlayer = new Map<string, { matchId: string; player: Player }[]>();
  for (const matchId of expected) {
    for (const player of byMatch.get(matchId)?.players ?? []) {
      const games = byPlayer.get(player.id) ?? [];
      games.push({ matchId, player });
      byPlayer.set(player.id, games);
    }
  }
  const ids = playerIds ? new Set(playerIds.map(id => identifier(id, 'Player ID'))) : byPlayer.keys();
  const players = Array.from(ids, id => {
    const games = byPlayer.get(id) ?? [];
    const rows = games.map(game => game.player);
    const totals = Object.fromEntries(metrics.map(metric => {
      const values = rows.flatMap(player => player.stats[metric] ?? []);
      return [metric, { value: values.length ? values.reduce((sum, value) => sum + value, 0) : null, games: values.length }];
    })) as Record<Metric, { value: number | null; games: number }>;
    return {
      id,
      name: rows.at(-1)?.name ?? id,
      games: games.map(game => ({ matchId: game.matchId, placement: game.player.placement, stats: game.player.stats })),
      totals,
      headshotRate: ratio(rows, 'headshots', 'hitsToPlayers'),
      damageRatio: ratio(rows, 'damageToPlayers', 'damageTaken')
    };
  });
  return {
    coverage: { expected: expected.size, analyzed: byMatch.size, missingMatchIds: [...expected].filter(id => !byMatch.has(id)) },
    players
  };
}

