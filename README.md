# BracketUp

A double-elimination tournament bracket creator and tracker for Android, built with Expo (TypeScript).

## Quick start

```bash
npm install
npx expo start
```

Then press `a` to open the Android emulator, or scan the QR code with Expo Go.

## EAS Android build

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## Project structure

```
app/                        expo-router screens
  _layout.tsx               root stack navigator
  index.tsx                 Home: list of tournaments
  new-tournament.tsx        Create tournament + add participants
  tournament/[id]/
    index.tsx               Bracket view
    results.tsx             Final standings + match history

components/
  BracketView.tsx           Horizontal scrollable bracket (two swimlanes)
  MatchCard.tsx             Individual match card with participant names/scores
  MatchDetailSheet.tsx      Bottom-sheet modal for entering scores
  ParticipantRow.tsx        Row used in New Tournament and Results screens

hooks/
  useTournament.ts          Loads/saves a single tournament from AsyncStorage;
                            exposes recordResult which applies doubleElimLogic
  useBracketEngine.ts       Pure derived state (grouping, counts, champion) for UI

utils/
  bracketGenerator.ts       Generates the full bracket match graph for N players
  doubleElimLogic.ts        Stateless result-recording and bracket advancement
  exportUtils.ts            JSON / plain-text export via expo-sharing

types/
  tournament.ts             All TypeScript interfaces (Tournament, Match, Participant…)
```

## Double-elimination bracket logic

### Generation (`bracketGenerator.ts`)

1. **Power-of-2 padding** — N players are rounded up to the next power of 2 (P).
   Extra slots become byes (null participants). Top seeds receive byes.

2. **Seeding** — Uses the standard recursive bracket-position algorithm:
   `positions(P) = positions(P/2).flatMap(s => [s, P+1-s])`
   producing matchups like 1v8, 4v5, 2v7, 3v6 for P=8.

3. **Winners Bracket** — Standard single-elimination tree.
   Each match points to the next match for its winner via `winnerNextMatchId`.

4. **Losers Bracket** — Alternating rounds:
   - **Consolidation** (odd LB rounds): previous LB survivors play each other.
   - **Drop-in** (even LB rounds): LB survivors face incoming WB losers.
   LB R1 cross-pairs WB R1 losers to avoid early rematches.
   LB R2k receives WB round k+1 losers.

5. **Grand Final** — Pre-creates two match slots:
   - Round 1: WB champion vs LB champion.
   - Round 2 (reset): played only if the LB champion wins Round 1 (both finalists then have one loss each).

6. **Bye propagation** — After the graph is wired, `propagateByes` iteratively:
   - Completes WB R1 bye matches immediately.
   - Cascades winners into the next-match slots.
   - Auto-completes any downstream match whose unfilled slot will never receive a participant (its feeder was itself a bye or void).

### Result recording (`doubleElimLogic.ts`)

`recordResult(tournament, matchId, winnerId, p1Score, p2Score)` returns a new Tournament (immutable update):
- Updates match status/scores/winner.
- Increments participant win/loss counters.
- Places the winner in the next WB/LB match slot.
- Places the loser in the LB (or marks them eliminated if they were already in LB).
- Re-runs bye propagation to resolve any newly deterministic slots.
- Handles the Grand Final reset branch.
- Assigns placements (1st, 2nd, 3rd…) on tournament completion.

## Persistence

All tournaments are stored as a JSON array in AsyncStorage under the key `@bracketup/tournaments`. Auto-saved after every result via `useTournament.recordResult`.

## Export

The **Export** button (top-right on the Bracket screen) offers:
- **JSON** — Full tournament object written to the device cache, then shared via the OS share sheet.
- **Text summary** — Human-readable standings + match history, also shared via the OS share sheet.

## Asset placeholders

Place `icon.png` (1024×1024), `splash.png` (1284×2778), `adaptive-icon.png` (1024×1024), and `favicon.png` (48×48) in the `assets/` folder before building.
For local development `npx expo start` works without them.
