import type { Season } from '@prisma/client';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useSearchParams } from '@remix-run/react';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import DfsSurvivorLineup from '~/components/layout/dfs-survivor/DfsSurvivorLineup';
import DfsSurvivorPlayerTable from '~/components/layout/dfs-survivor/DfsSurvivorPlayerTable';
import DfsSurvivorWeekRail from '~/components/layout/dfs-survivor/DfsSurvivorWeekRail';
import Button from '~/components/ui/FlexSpotButton';
import { prisma } from '~/db.server';
import type { PickerPlayer, PlayerUsage } from '~/libs/dfs-survivor/picker';
import { decoratePickerPlayers } from '~/libs/dfs-survivor/picker';
import {
  getSeasonTotalsByPlayer,
  getWeekScoresByPlayer,
} from '~/libs/dfs-survivor/player-week-scores.server';
import type { DfsSurvivorSlot } from '~/libs/dfs-survivor/slots';
import {
  DFS_SURVIVOR_LAST_WEEK,
  DFS_SURVIVOR_POSITIONS,
  DFS_SURVIVOR_SLOTS,
  SLOT_POSITIONS,
  isDfsSurvivorSlot,
} from '~/libs/dfs-survivor/slots';
import {
  createDfsSurvivorYear,
  getDfsSurvivorYearByUserAndYear,
} from '~/models/dfssurvivoryear.server';
import { getCurrentNflWeek, getWeekNflGames } from '~/models/nflgame.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { getCurrentTime } from '~/utils/time';

export type { PickerPlayer } from '~/libs/dfs-survivor/picker';

export type WeekSummary = {
  week: number;
  filledSlots: number;
  points: number;
  isScored: boolean;
  /** Every game of the week has kicked off. */
  isLocked: boolean;
};

/**
 * A saved pick, carrying everything its lineup row needs. Snapshotted from the
 * entry rather than looked up in the picker list: a player who is released or
 * loses their team drops out of that list, and the row would otherwise render
 * as an empty slot - with its lock lost, letting a scored pick be cleared.
 */
export type SlotEntry = {
  playerId: string;
  points: number;
  name: string;
  teamAbbr: string;
  opponentAbbr: string | null;
  isHome: boolean;
  projection: number | null;
  /**
   * What they actually scored, once their game is final. Null while the game is
   * still to come or in progress, which is when the projection is shown instead.
   */
  actualPoints: number | null;
  /** Their game has kicked off, so the slot can no longer be edited. */
  isLocked: boolean;
};

type LoaderData =
  | {
      isOpen: true;
      currentSeason: Season;
      selectedWeek: number;
      currentNflWeek: number;
      weekSummaries: WeekSummary[];
      entries: Partial<Record<DfsSurvivorSlot, SlotEntry>>;
      players: PickerPlayer[];
      isWeekScored: boolean;
      currentTime: Date;
    }
  | { isOpen: false; currentSeason: Season | null };

type ActionResponse = { message?: string; error?: string };

/** Sleeper's terminal game status: its stat lines will not change again. */
const GAME_COMPLETE = 'complete';

/**
 * Reads the eleven slots off a form submission, rejecting anything that isn't a
 * known slot name so a hand-rolled POST can't write junk positions.
 */
function readSubmittedSlots(formData: FormData) {
  const slots = new Map<DfsSurvivorSlot, string>();

  for (const slot of DFS_SURVIVOR_SLOTS) {
    const value = formData.get(`playerId-${slot}`);
    if (typeof value !== 'string') continue;
    if (value) slots.set(slot, value);
    else slots.set(slot, '');
  }

  return slots;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const formData = await request.formData();
  const currentTime = getCurrentTime(
    (formData.get('__test_current_time__') as string) || undefined,
  );

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return typedjson<ActionResponse>({ error: 'No active season found' });
  }
  if (!currentSeason.isOpenForDFSSurvivor) {
    return typedjson<ActionResponse>({
      error: 'DFS Survivor is closed for the season',
    });
  }

  const weekNumber = Number(formData.get('week'));
  if (!Number.isInteger(weekNumber)) {
    return typedjson<ActionResponse>({ error: 'Invalid week' });
  }

  const week = await prisma.dFSSurvivorUserWeek.findUnique({
    where: {
      userId_year_week: {
        userId: user.id,
        year: currentSeason.year,
        week: weekNumber,
      },
    },
    include: { entries: true },
  });

  if (!week) {
    return typedjson<ActionResponse>({ error: 'Week not found' });
  }
  if (week.isScored) {
    return typedjson<ActionResponse>({
      error: `Week ${weekNumber} has already been scored`,
    });
  }

  const submitted = readSubmittedSlots(formData);
  // Players the user explicitly agreed to move out of another week.
  const released = new Set(formData.getAll('release').map(String));

  const selectedIds = [...submitted.values()].filter(Boolean);

  // Same player in two slots of the same week.
  const seen = new Map<string, DfsSurvivorSlot>();
  for (const [slot, playerId] of submitted) {
    if (!playerId) continue;
    const other = seen.get(playerId);
    if (other) {
      return typedjson<ActionResponse>({
        error: `The same player can't fill both ${other} and ${slot}.`,
      });
    }
    seen.set(playerId, slot);
  }

  const [players, games] = await Promise.all([
    prisma.player.findMany({
      where: { id: { in: selectedIds } },
      include: { currentNFLTeam: true },
    }),
    getWeekNflGames(currentSeason.year, weekNumber),
  ]);

  const playersById = new Map(players.map(player => [player.id, player]));
  const gameByTeamId = new Map<string, (typeof games)[number]>();
  for (const game of games) {
    gameByTeamId.set(game.homeTeamId, game);
    gameByTeamId.set(game.awayTeamId, game);
  }

  const existingBySlot = new Map(
    week.entries.map(entry => [entry.position, entry]),
  );

  const writes: { slot: DfsSurvivorSlot; playerId: string; gameId: string }[] =
    [];
  const clears: DfsSurvivorSlot[] = [];

  for (const [slot, playerId] of submitted) {
    const existing = existingBySlot.get(slot);
    const unchanged = existing?.playerId === playerId;
    if (unchanged) continue;

    // Whatever is being replaced or removed must not have started yet either,
    // otherwise a locked pick could be swapped out after kickoff.
    if (existing) {
      const existingGame = games.find(game => game.id === existing.nflGameId);
      if (existingGame && existingGame.gameStartTime <= currentTime) {
        return typedjson<ActionResponse>({
          error: `${slot} is locked - that game has already started.`,
        });
      }
    }

    if (!playerId) {
      clears.push(slot);
      continue;
    }

    const player = playersById.get(playerId);
    if (!player?.currentNFLTeam) {
      return typedjson<ActionResponse>({
        error: `No current team on file for the player picked at ${slot}.`,
      });
    }

    if (!SLOT_POSITIONS[slot].includes(player.position ?? '')) {
      return typedjson<ActionResponse>({
        error: `${player.fullName} is a ${player.position} and can't fill ${slot}.`,
      });
    }

    const game = gameByTeamId.get(player.currentNFLTeam.id);
    if (!game) {
      return typedjson<ActionResponse>({
        error: `${player.fullName} is on a bye in week ${weekNumber}.`,
      });
    }
    if (game.gameStartTime <= currentTime) {
      return typedjson<ActionResponse>({
        error: `${player.fullName}'s game has already started.`,
      });
    }

    writes.push({ slot, playerId, gameId: game.id });
  }

  if (writes.length === 0 && clears.length === 0) {
    return typedjson<ActionResponse>({ message: 'No changes to save.' });
  }

  // A player may only be used once all season. Anything already banked in
  // another week has to be released first, which the UI asks about explicitly.
  const elsewhere = await prisma.dFSSurvivorUserEntry.findMany({
    where: {
      userId: user.id,
      year: currentSeason.year,
      playerId: { in: writes.map(write => write.playerId) },
      week: { not: weekNumber },
    },
    include: { player: true },
  });

  const blocked = elsewhere.filter(entry => !released.has(entry.playerId));
  if (blocked.length > 0) {
    const first = blocked[0];
    return typedjson<ActionResponse>({
      error: `${first.player.fullName} is already used in week ${first.week}. Move them here to free up that slot.`,
    });
  }

  // A released player's other week must not have kicked off either.
  for (const entry of elsewhere) {
    const game = await prisma.nFLGame.findUnique({
      where: { id: entry.nflGameId },
      select: { gameStartTime: true },
    });
    if (game && game.gameStartTime <= currentTime) {
      return typedjson<ActionResponse>({
        error: `${entry.player.fullName} can't be moved - their week ${entry.week} game has already started.`,
      });
    }
  }

  await prisma.$transaction([
    ...elsewhere.map(entry =>
      prisma.dFSSurvivorUserEntry.delete({ where: { id: entry.id } }),
    ),
    ...clears.map(slot =>
      prisma.dFSSurvivorUserEntry.deleteMany({
        where: {
          userId: user.id,
          year: currentSeason.year,
          week: weekNumber,
          position: slot,
        },
      }),
    ),
    ...writes.map(write =>
      prisma.dFSSurvivorUserEntry.upsert({
        where: {
          userId_year_week_position: {
            userId: user.id,
            year: currentSeason.year,
            week: weekNumber,
            position: write.slot,
          },
        },
        update: {
          playerId: write.playerId,
          nflGameId: write.gameId,
          points: 0,
        },
        create: {
          userId: user.id,
          year: currentSeason.year,
          week: weekNumber,
          position: write.slot,
          playerId: write.playerId,
          nflGameId: write.gameId,
          points: 0,
        },
      }),
    ),
  ]);

  const moved = elsewhere.length
    ? ` ${elsewhere.length} pick${
        elsewhere.length === 1 ? '' : 's'
      } moved from another week.`
    : '';

  return typedjson<ActionResponse>({
    message: `Week ${weekNumber} saved.${moved}`,
  });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason: null });
  }
  if (!currentSeason.isOpenForDFSSurvivor) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason });
  }

  const url = new URL(request.url);
  const currentTime = getCurrentTime(
    url.searchParams.get('__test_current_time__') || undefined,
  );

  let dfsSurvivorYear = await getDfsSurvivorYearByUserAndYear(
    user.id,
    currentSeason.year,
  );
  if (!dfsSurvivorYear) {
    dfsSurvivorYear = await createDfsSurvivorYear(user.id, currentSeason.year);
  }

  const currentNflWeek =
    (await getCurrentNflWeek(currentSeason.year, currentTime)) ?? 1;

  const requested = Number(url.searchParams.get('week'));
  const selectedWeek = Math.min(
    Math.max(
      Number.isInteger(requested) && requested > 0 ? requested : currentNflWeek,
      1,
    ),
    DFS_SURVIVOR_LAST_WEEK,
  );

  const yearWithEntries = await prisma.dFSSurvivorUserYear.findUnique({
    where: { id: dfsSurvivorYear.id },
    include: {
      weeks: {
        include: {
          entries: {
            include: { player: { include: { currentNFLTeam: true } } },
          },
        },
      },
    },
  });

  const weeks = yearWithEntries?.weeks ?? [];

  const [players, games, weekScores, seasonTotals] = await Promise.all([
    prisma.player.findMany({
      where: {
        position: { in: DFS_SURVIVOR_POSITIONS },
        currentNFLTeamId: { not: null },
      },
      include: { currentNFLTeam: true },
    }),
    getWeekNflGames(currentSeason.year, selectedWeek),
    getWeekScoresByPlayer(currentSeason.year, selectedWeek),
    getSeasonTotalsByPlayer(currentSeason.year),
  ]);

  const { projections, actuals } = weekScores;

  // Which week (if any) each player is already banked in, across the season.
  const usage = new Map<string, PlayerUsage>();
  for (const week of weeks) {
    for (const entry of week.entries) {
      usage.set(entry.playerId, {
        week: week.week,
        points: entry.points,
        isScored: week.isScored,
      });
    }
  }

  const pickerPlayers: PickerPlayer[] = decoratePickerPlayers({
    players,
    games,
    projections,
    seasonTotals,
    usage,
    currentTime,
  });

  // Locking a week needs its own last kickoff, so fetch them in one grouped
  // query rather than a request per week.
  const weekKickoffs = await prisma.nFLGame.groupBy({
    where: { year: currentSeason.year },
    by: ['week'],
    _max: { gameStartTime: true },
  });
  const lastKickoff = new Map(
    weekKickoffs.map(row => [row.week, row._max.gameStartTime]),
  );

  const weekSummaries: WeekSummary[] = [];
  for (let week = 1; week <= DFS_SURVIVOR_LAST_WEEK; week++) {
    const record = weeks.find(candidate => candidate.week === week);
    const last = lastKickoff.get(week);
    weekSummaries.push({
      week,
      filledSlots: record?.entries.length ?? 0,
      points: record?.entries.reduce((sum, e) => sum + e.points, 0) ?? 0,
      isScored: record?.isScored ?? false,
      isLocked: last ? last <= currentTime : false,
    });
  }

  const gameById = new Map(games.map(game => [game.id, game]));

  const selected = weeks.find(week => week.week === selectedWeek);
  const entries: Partial<Record<DfsSurvivorSlot, SlotEntry>> = {};
  for (const entry of selected?.entries ?? []) {
    if (!isDfsSurvivorSlot(entry.position)) continue;

    // Lock from the game the entry was actually saved against, not from the
    // player's current team - a bye or a trade must not unlock a live pick.
    const game = gameById.get(entry.nflGameId);
    const isHome = !!game && game.homeTeamId === entry.player.currentNFLTeamId;
    const opponent = game ? (isHome ? game.awayTeam : game.homeTeam) : null;

    entries[entry.position] = {
      playerId: entry.playerId,
      points: entry.points,
      name:
        entry.player.position === 'DEF'
          ? entry.player.currentNFLTeam?.sleeperId ?? entry.player.fullName
          : entry.player.fullName,
      teamAbbr: entry.player.currentNFLTeam?.sleeperId ?? '',
      opponentAbbr: opponent?.sleeperId ?? null,
      isHome,
      projection: projections.get(entry.playerId) ?? null,
      // Only trusted once the game is final: a live stat line would otherwise
      // read as a finished score while the player is still on the field.
      // A player with no stored stat line stays null rather than falling back
      // to 0 - the sync is a manual admin job, so a finished game can easily
      // have no row yet, and a stale 0 would read as a real final score.
      actualPoints:
        game?.status === GAME_COMPLETE
          ? actuals.get(entry.playerId) ?? null
          : null,
      isLocked: game ? game.gameStartTime <= currentTime : false,
    };
  }

  return typedjson<LoaderData>({
    isOpen: true,
    currentSeason,
    selectedWeek,
    currentNflWeek,
    weekSummaries,
    entries,
    players: pickerPlayers,
    isWeekScored: selected?.isScored ?? false,
    currentTime,
  });
};

type Lineup = Record<DfsSurvivorSlot, string | null>;

const EMPTY_LINEUP = Object.fromEntries(
  DFS_SURVIVOR_SLOTS.map(slot => [slot, null]),
) as Lineup;

function lineupFromEntries(
  entries: Partial<Record<DfsSurvivorSlot, SlotEntry>>,
): Lineup {
  const lineup = { ...EMPTY_LINEUP };
  for (const slot of DFS_SURVIVOR_SLOTS) {
    lineup[slot] = entries[slot]?.playerId ?? null;
  }
  return lineup;
}

export default function GamesDfsSurvivorMyEntry() {
  const data = useTypedLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [, setSearchParams] = useSearchParams();

  const isOpen = data.isOpen;
  const selectedWeek = isOpen ? data.selectedWeek : 1;

  // Memoised so the closed-season fallbacks don't hand back a fresh object on
  // every render, which would retrigger the reseeding effect in a loop.
  const entries = useMemo(() => (data.isOpen ? data.entries : {}), [data]);
  const players = useMemo(() => (data.isOpen ? data.players : []), [data]);

  const [lineup, setLineup] = useState<Lineup>(() =>
    lineupFromEntries(entries),
  );
  const [activeSlot, setActiveSlot] = useState<DfsSurvivorSlot>('QB1');
  const [released, setReleased] = useState<Set<string>>(new Set());
  const [pendingMove, setPendingMove] = useState<PickerPlayer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reseeding is keyed on a signature of what the server says is saved, not on
  // `entries` identity (changes on every revalidation, discarding unsaved work)
  // and not on `fetcher.data` (changes the moment the action replies, before
  // the revalidated loader data lands - which reset the panel to pre-save state
  // and left it reading "Unsaved changes" next to a success banner, and reset
  // it on failed saves too). A signature only moves when server truth moves.
  const savedSignature = useMemo(
    () =>
      [
        selectedWeek,
        ...DFS_SURVIVOR_SLOTS.map(slot => entries[slot]?.playerId ?? ''),
      ].join('|'),
    [selectedWeek, entries],
  );

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    setLineup(lineupFromEntries(entriesRef.current));
    setReleased(new Set());
    setPendingMove(null);
    setNotice(null);
  }, [savedSignature]);

  const playersById = useMemo(
    () => new Map(players.map(player => [player.id, player])),
    [players],
  );

  const lineupPlayerIds = useMemo(
    () =>
      new Set(
        DFS_SURVIVOR_SLOTS.map(slot => lineup[slot]).filter(
          (id): id is string => !!id,
        ),
      ),
    [lineup],
  );

  /** Slots that can no longer be edited, mapped to why. */
  const lockedSlots = useMemo(() => {
    const locked: Partial<Record<DfsSurvivorSlot, string>> = {};
    if (!isOpen) return locked;

    for (const slot of DFS_SURVIVOR_SLOTS) {
      if (data.isWeekScored) {
        locked[slot] = 'Week has been scored';
        continue;
      }
      // Only the saved pick locks a slot - an unsaved one can still be undone.
      if (entries[slot]?.isLocked) locked[slot] = 'Game has already started';
    }
    return locked;
  }, [isOpen, data, entries]);

  const isDirty = useMemo(
    () =>
      DFS_SURVIVOR_SLOTS.some(
        slot => lineup[slot] !== (entries[slot]?.playerId ?? null),
      ),
    [lineup, entries],
  );

  /** Puts a player in a slot, vacating any other slot they already occupy. */
  const assign = useCallback(
    (slot: DfsSurvivorSlot, playerId: string) => {
      const next = { ...lineup };
      for (const candidate of DFS_SURVIVOR_SLOTS) {
        if (next[candidate] === playerId) next[candidate] = null;
      }
      next[slot] = playerId;
      setLineup(next);

      // Jump to the next slot still waiting on a pick.
      const start = DFS_SURVIVOR_SLOTS.indexOf(slot);
      const nextEmpty = [
        ...DFS_SURVIVOR_SLOTS.slice(start + 1),
        ...DFS_SURVIVOR_SLOTS.slice(0, start),
      ].find(candidate => !next[candidate]);
      if (nextEmpty) setActiveSlot(nextEmpty);
    },
    [lineup],
  );

  const handleSelectPlayer = useCallback(
    (player: PickerPlayer) => {
      setNotice(null);

      if (lockedSlots[activeSlot]) return;
      if (!SLOT_POSITIONS[activeSlot].includes(player.position)) {
        setNotice(
          `${player.name} is a ${player.position} and can't fill ${activeSlot}.`,
        );
        return;
      }

      // Already banked in another week: ask before moving them, rather than
      // silently refusing the way the old dropdown did.
      const usedElsewhere =
        player.usedInWeek !== null &&
        player.usedInWeek !== selectedWeek &&
        !released.has(player.id);

      if (usedElsewhere) {
        setPendingMove(player);
        return;
      }

      assign(activeSlot, player.id);
    },
    [activeSlot, assign, lockedSlots, released, selectedWeek],
  );

  const confirmMove = useCallback(() => {
    if (!pendingMove) return;
    setReleased(previous => new Set(previous).add(pendingMove.id));
    assign(activeSlot, pendingMove.id);
    setPendingMove(null);
  }, [pendingMove, assign, activeSlot]);

  const handleClearSlot = useCallback(
    (slot: DfsSurvivorSlot) => {
      if (lockedSlots[slot]) return;
      setLineup(previous => ({ ...previous, [slot]: null }));
      setActiveSlot(slot);
    },
    [lockedSlots],
  );

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append('week', String(selectedWeek));
    for (const slot of DFS_SURVIVOR_SLOTS) {
      formData.append(`playerId-${slot}`, lineup[slot] ?? '');
    }
    // Only the players actually still in the lineup need releasing.
    for (const playerId of released) {
      if (lineupPlayerIds.has(playerId)) formData.append('release', playerId);
    }
    fetcher.submit(formData, { method: 'post' });
  }, [selectedWeek, lineup, released, lineupPlayerIds, fetcher]);

  const handleDiscard = useCallback(() => {
    setLineup(lineupFromEntries(entries));
    setReleased(new Set());
    setPendingMove(null);
    setNotice(null);
  }, [entries]);

  const selectWeek = useCallback(
    (week: number) => {
      if (week === selectedWeek) return;
      setSearchParams(
        previous => {
          const next = new URLSearchParams(previous);
          next.set('week', String(week));
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setSearchParams, selectedWeek],
  );

  if (!data.isOpen) {
    return (
      <div>
        <h2>
          {data.currentSeason ? 'DFS Survivor Closed' : 'Season Not Available'}
        </h2>
        <p>
          {data.currentSeason
            ? 'DFS survivor is currently closed for the season.'
            : 'Season is currently not available.'}
        </p>
      </div>
    );
  }

  const isSaving = fetcher.state !== 'idle';
  const message = fetcher.data?.error ?? notice ?? fetcher.data?.message;
  const isError = !!(fetcher.data?.error || notice);

  return (
    // The app shell wraps every page in `prose lg:prose-xl` (root.tsx), which
    // sets a 20px base and styles bare tables. Both wreck a dense data view, so
    // this one opts out and sets its own scale.
    <>
      <h2>My DFS Survivor Entries</h2>
      <div className='not-prose text-slate-200'>
        <DfsSurvivorWeekRail
          weeks={data.weekSummaries}
          selectedWeek={selectedWeek}
          currentNflWeek={data.currentNflWeek}
          onSelectWeek={selectWeek}
          isLocked={isDirty}
          lockedReason={`Save or discard your week ${selectedWeek} changes first`}
        />

        {message && (
          <div
            role={isError ? 'alert' : 'status'}
            className={clsx(
              'mb-3 rounded-md px-3 py-2 text-sm',
              isError
                ? 'bg-red-900/50 text-red-100'
                : 'bg-green-900/50 text-green-100',
            )}
          >
            {message}
          </div>
        )}

        {pendingMove && (
          <div className='mb-3 flex flex-wrap items-center gap-3 rounded-md bg-amber-900/50 px-3 py-2 text-sm text-amber-100'>
            <span>
              {pendingMove.name} is already used in week{' '}
              {pendingMove.usedInWeek}. Move them to week {selectedWeek}?
            </span>
            <Button type='button' onClick={confirmMove}>
              Move here
            </Button>
            <Button type='button' onClick={() => setPendingMove(null)}>
              Cancel
            </Button>
          </div>
        )}

        <div className='grid items-start gap-4 lg:grid-cols-[minmax(19rem,22rem)_1fr]'>
          <section
            className={clsx(
              'overflow-hidden rounded-md border bg-slate-800/40 transition-colors',
              isDirty ? 'border-amber-500/70' : 'border-slate-700',
            )}
          >
            {/* Matches the player panel's control-bar height so the two columns
                start on the same baseline. */}
            <header className='flex h-12 items-center justify-between border-b border-slate-700 px-3'>
              <h3 className='m-0 text-sm font-semibold text-white'>
                Week {selectedWeek} lineup
              </h3>
              <span className='text-xs tabular-nums text-slate-400'>
                {lineupPlayerIds.size}/11
              </span>
            </header>

            <DfsSurvivorLineup
              lineup={lineup}
              playersById={playersById}
              entries={entries}
              activeSlot={activeSlot}
              onActivateSlot={setActiveSlot}
              onClearSlot={handleClearSlot}
              lockedSlots={lockedSlots}
              isWeekScored={data.isWeekScored}
            />

            <div className='sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-700 bg-slate-800/95 px-3 py-2 backdrop-blur'>
              <span className='text-xs text-amber-300'>
                {isDirty && !isSaving ? 'Unsaved changes' : '\u00a0'}
              </span>
              <span className='flex shrink-0 items-center gap-2'>
                {isDirty && !isSaving && (
                  <Button
                    type='button'
                    onClick={handleDiscard}
                    className='bg-transparent text-slate-300 hover:bg-slate-700'
                    data-testid='discard-week-button'
                  >
                    Discard
                  </Button>
                )}
                <Button
                  type='button'
                  onClick={handleSave}
                  disabled={isSaving || !isDirty || data.isWeekScored}
                  data-testid='save-week-button'
                >
                  {isSaving ? 'Saving\u2026' : 'Save'}
                </Button>
              </span>
            </div>
          </section>

          <DfsSurvivorPlayerTable
            players={data.players}
            activeSlot={activeSlot}
            selectedWeek={selectedWeek}
            lineupPlayerIds={lineupPlayerIds}
            onSelectPlayer={handleSelectPlayer}
          />
        </div>
      </div>
    </>
  );
}
