# replay-toolkit

Turn parsed Fortnite replay data into match and tournament-round reports. Built to support Clutch, the competitive Fortnite tracker for fans and players.

## Try it

Requires Node.js 22.18 or newer. No dependencies, API key, or replay credits are needed for the demo.

```sh
npm run demo
node cli.ts fixtures/round.json --player mica --player rook
npm test
```

If PowerShell blocks npm.ps1, run the demo directly with Node:

    node cli.ts fixtures/round.json

The demo contains four synthetic matches. The CLI writes JSON to standard output and errors to standard error.

## Input and output

A round input has a list of expected match IDs and zero or more parsed replays. Each replay contains a match ID and a `game.players` array or an object of player rows.

```json
{
  "matchIds": ["game-01", "game-02"],
  "replays": [
    {
      "matchId": "game-01",
      "game": {
        "players": [
          {
            "playerId": "maya",
            "displayName": "Maya",
            "placement": 3,
            "kills": 2,
            "headshots": 1,
            "hitsToPlayers": 5
          }
        ]
      }
    }
  ]
}
```

Use Epic account IDs for real players. Use session IDs for matches. The report shows expected, analyzed, and missing matches, then game placements and stats per player. Repeated match IDs count once. Metrics report the number of player-games with a value. A measured zero stays zero and missing totals are `null`.

Headshot rate divides total headshots by total hits against players. Damage ratio divides total damage dealt to players by total damage taken. Each ratio includes only games with both inputs and returns `null` when the combined denominator is zero. Ratios are decimal numbers. For example, `0.2` means 20%. Placement is reported per match. Tournament points and official round rank come from tournament standings.

## Library

Import the local TypeScript module on Node.js 22.18 or newer.

```ts
import { readRound, summarizeRound } from './src/stats.ts';

const report = summarizeRound(readRound(input), ['maya']);
```

`normalizeReplay(matchId, payload)` converts a single provider response to the library's match format. `summarizeRound` takes normalized matches and expected IDs. See [src/stats.ts](src/stats.ts) for the supported metrics and types.

### Optional API-Fortnite adapter

The adapter fetches parsed stats for a known tournament match using your server-side key. Call it only when you're ready to spend one stats-only parsing credit. It makes one request and lets the caller handle caching and retries.

```ts
import { fetchReplayStats } from './src/api-fortnite.ts';
import { summarizeRound } from './src/stats.ts';

const match = await fetchReplayStats(matchId, {
  apiKey: process.env.FORTNITE_API_KEY ?? '',
  spendCredit: true
});
const report = summarizeRound({ matchIds: [matchId], matches: [match] });
```

The offline CLI accepts parsed JSON. Raw Fortnite replay decoding is outside this release. Use synthetic data for public fixtures and follow the provider's terms for any live data you fetch or store.

## Contributing

To add a metric, add its input name in `metrics`, document how it is interpreted, and add a synthetic fixture or test that covers missing values as well as a valid zero. Run `npm test` and `npm run demo` before opening a pull request.

[MIT license](LICENSE).

