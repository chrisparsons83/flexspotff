import { fSquaredEntryPoints, winnersOf } from './sideGameScoring';
import { assignCompetitionRanks } from '~/utils/rank';

/**
 * The F² tab, worked out from rows the server has already loaded - kept apart
 * from `fSquared.server.ts` so the rules can be tested without a database.
 *
 * An entry picks two teams from each league before it drafts, and scores the
 * combined points-for of everything it picked. So the tab looks at a member
 * from two sides: the entries they made, and the teams they managed that
 * everyone else was picking.
 *
 * A league that has not drafted yet is left out of both. The standings page
 * shows those picks as "Pending", and a profile is no place to leak them.
 */

export type FSquaredMember = {
  id: string;
  discordName: string;
  discordUsername: string | null;
};

/** One team in a year F² was played, whether anyone picked it or not. */
export type FSquaredTeamRow = {
  id: string;
  year: number;
  leagueId: string;
  leagueName: string;
  tier: number;
  draftDateTime: Date | null;
  pointsFor: number;
  manager: FSquaredMember | null;
};

export type FSquaredEntryRow = {
  year: number;
  entrant: FSquaredMember;
  teamIds: string[];
};

export type FSquaredFinish = { rank: number; fieldSize: number };

export type FSquaredPick = {
  teamId: string;
  year: number;
  leagueName: string;
  tier: number;
  manager: FSquaredMember | null;
  pointsFor: number;
  /** Where the team finished in its league on points-for, sharing ties. */
  leagueRank: number;
  leagueSize: number;
  /** Points-for over the average team in its league. */
  vsLeague: number;
  /** The other entrants who picked the same team. */
  sharedBy: number;
  /** The member picked a team they manage. */
  isSelf: boolean;
};

export type FSquaredSeason = {
  year: number;
  inProgress: boolean;
  total: number;
  finish: FSquaredFinish;
  champion: boolean;
  /** Total over the average entry that year. */
  vsField: number;
  picks: FSquaredPick[];
  averagePickRank: number | null;
  bestPick: FSquaredPick | null;
  worstPick: FSquaredPick | null;
  pickedSelf: boolean;
  /** Entries that picked the member's own team, or null if they had none. */
  timesPicked: number | null;
};

export type FSquaredCareer = {
  seasons: number;
  completedSeasons: number;
  titles: number;
  podiums: number;
  bestFinish: (FSquaredFinish & { year: number }) | null;
  /** 100% is first every time, 0% last every time. */
  averagePercentile: number | null;
  averageTotal: number | null;
  averageVsField: number | null;
  bestSeason: { year: number; vsField: number } | null;
  worstSeason: { year: number; vsField: number } | null;
  picks: number;
  averagePickRank: number | null;
  topThreeShare: number | null;
  bottomThreeShare: number | null;
  bestPickEver: FSquaredPick | null;
  selfPicks: number;
  current: (FSquaredFinish & { year: number }) | null;
};

export type FSquaredFavoriteManager = {
  manager: FSquaredMember;
  picks: number;
  years: number[];
  averageRank: number;
  averageVsLeague: number;
  isSelf: boolean;
};

export type FSquaredPickedBySeason = {
  year: number;
  inProgress: boolean;
  teamId: string;
  leagueName: string;
  tier: number;
  pointsFor: number;
  leagueRank: number;
  leagueSize: number;
  /** Everyone whose entry picked this team, the member included. */
  pickers: (FSquaredMember & { isSelf: boolean })[];
  fieldSize: number;
  share: number;
  /** Where the team ranked in its league on how many entries picked it. */
  popularityRank: number;
};

export type FSquaredFan = {
  member: FSquaredMember;
  picks: number;
  years: number[];
};

export type FSquaredPickedBy = {
  seasons: FSquaredPickedBySeason[];
  timesPicked: number;
  averageShare: number | null;
  mostPicked: FSquaredPickedBySeason | null;
  bestPopularityRank: number | null;
  /** Other members who picked them, most often first. */
  topFans: FSquaredFan[];
};

const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const average = (values: number[]) =>
  values.length > 0 ? sum(values) / values.length : null;

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function extremes<T>(marks: T[], scoreOf: (mark: T) => number) {
  let best: T | null = null;
  let worst: T | null = null;
  for (const mark of marks) {
    if (!best || scoreOf(mark) > scoreOf(best)) best = mark;
    if (!worst || scoreOf(mark) < scoreOf(worst)) worst = mark;
  }
  return { best, worst };
}

/** Leagues in tier order, so every list on the tab reads top league first. */
const byLeague = (
  a: { tier: number; leagueName: string },
  b: { tier: number; leagueName: string },
) => a.tier - b.tier || a.leagueName.localeCompare(b.leagueName);

/** A league still to draft keeps its picks secret. */
export function isDrafted(draftDateTime: Date | null, now: Date): boolean {
  return draftDateTime !== null && draftDateTime <= now;
}

type TeamStats = FSquaredTeamRow & {
  leagueRank: number;
  leagueSize: number;
  vsLeague: number;
  popularityRank: number;
  pickers: FSquaredMember[];
};

/**
 * Every drafted team with its standing in its league, both on points-for and
 * on how many entries picked it.
 */
function buildTeamStats(
  teams: FSquaredTeamRow[],
  entries: FSquaredEntryRow[],
  now: Date,
): Map<string, TeamStats> {
  const pickers = new Map<string, FSquaredMember[]>();
  for (const entry of entries) {
    for (const teamId of entry.teamIds) {
      const list = pickers.get(teamId);
      if (list) list.push(entry.entrant);
      else pickers.set(teamId, [entry.entrant]);
    }
  }

  const stats = new Map<string, TeamStats>();
  const drafted = teams.filter(team => isDrafted(team.draftDateTime, now));

  for (const league of groupBy(drafted, team => team.leagueId).values()) {
    const leagueAverage = average(league.map(team => team.pointsFor)) ?? 0;
    const withPickers = league.map(team => ({
      ...team,
      pickers: pickers.get(team.id) ?? [],
    }));
    const byPoints = assignCompetitionRanks(
      [...withPickers].sort((a, b) => b.pointsFor - a.pointsFor),
      team => team.pointsFor,
    );
    const popularity = new Map(
      assignCompetitionRanks(
        [...withPickers].sort((a, b) => b.pickers.length - a.pickers.length),
        team => team.pickers.length,
      ).map(team => [team.id, team.rank]),
    );

    for (const team of byPoints) {
      const { rank, ...rest } = team;
      stats.set(team.id, {
        ...rest,
        leagueRank: rank,
        leagueSize: league.length,
        vsLeague: team.pointsFor - leagueAverage,
        popularityRank: popularity.get(team.id)!,
      });
    }
  }

  return stats;
}

/**
 * The member's entries, newest first, each ranked against that year's field
 * the way the standings page ranks it.
 */
export function buildFSquaredSeasons({
  userId,
  entries,
  teamStats,
  inProgressYear,
}: {
  userId: string;
  entries: FSquaredEntryRow[];
  teamStats: Map<string, TeamStats>;
  inProgressYear: number | null;
}): FSquaredSeason[] {
  const seasons: FSquaredSeason[] = [];

  for (const [year, yearEntries] of groupBy(entries, entry => entry.year)) {
    const totals = yearEntries.map(entry => ({
      userId: entry.entrant.id,
      total: fSquaredEntryPoints(
        entry.teamIds.flatMap(id => {
          const team = teamStats.get(id);
          return team ? [team] : [];
        }),
      ),
    }));
    const ranked = assignCompetitionRanks(
      [...totals].sort((a, b) => b.total - a.total),
      entry => entry.total,
    );
    const mine = ranked.find(entry => entry.userId === userId);
    const myEntry = yearEntries.find(entry => entry.entrant.id === userId);
    if (!mine || !myEntry) continue;

    const picks: FSquaredPick[] = myEntry.teamIds
      .flatMap(id => {
        const team = teamStats.get(id);
        return team ? [team] : [];
      })
      .map(team => ({
        teamId: team.id,
        year,
        leagueName: team.leagueName,
        tier: team.tier,
        manager: team.manager,
        pointsFor: team.pointsFor,
        leagueRank: team.leagueRank,
        leagueSize: team.leagueSize,
        vsLeague: team.vsLeague,
        sharedBy: team.pickers.filter(picker => picker.id !== userId).length,
        isSelf: team.manager?.id === userId,
      }))
      .sort((a, b) => byLeague(a, b) || a.leagueRank - b.leagueRank);

    // Nothing drafted yet, so nothing to show and a field tied at zero.
    if (picks.length === 0) continue;

    const ownTeams = Array.from(teamStats.values()).filter(
      team => team.year === year && team.manager?.id === userId,
    );
    const { best, worst } = extremes(picks, pick => pick.vsLeague);
    const inProgress = year === inProgressYear;

    seasons.push({
      year,
      inProgress,
      total: mine.total,
      finish: { rank: mine.rank, fieldSize: ranked.length },
      champion:
        !inProgress &&
        winnersOf(
          new Map(totals.map(entry => [entry.userId, entry.total])),
        ).has(userId),
      vsField: mine.total - (average(totals.map(entry => entry.total)) ?? 0),
      picks,
      averagePickRank: average(picks.map(pick => pick.leagueRank)),
      bestPick: best,
      worstPick: worst,
      pickedSelf: picks.some(pick => pick.isSelf),
      timesPicked:
        ownTeams.length > 0
          ? sum(ownTeams.map(team => team.pickers.length))
          : null,
    });
  }

  return seasons.sort((a, b) => b.year - a.year);
}

/**
 * Career numbers from the season list. Picks count from every season, the
 * running one included; finishes and titles wait for a season to end, the
 * same rule the F² Champion badge follows.
 */
export function buildFSquaredCareer(seasons: FSquaredSeason[]): FSquaredCareer {
  const oldestFirst = [...seasons].sort((a, b) => a.year - b.year);
  const completed = oldestFirst.filter(season => !season.inProgress);
  const picks = oldestFirst.flatMap(season => season.picks);

  let bestFinish: FSquaredCareer['bestFinish'] = null;
  for (const season of completed) {
    // Latest wins a tie, so a repeat champion is shown their newest title.
    if (!bestFinish || season.finish.rank <= bestFinish.rank) {
      bestFinish = { ...season.finish, year: season.year };
    }
  }

  const { best: bestSeason, worst: worstSeason } = extremes(
    completed.map(season => ({ year: season.year, vsField: season.vsField })),
    season => season.vsField,
  );
  const running = seasons.find(season => season.inProgress);

  return {
    seasons: seasons.length,
    completedSeasons: completed.length,
    titles: completed.filter(season => season.champion).length,
    podiums: completed.filter(season => season.finish.rank <= 3).length,
    bestFinish,
    averagePercentile: average(
      completed.map(({ finish }) =>
        finish.fieldSize > 1
          ? (finish.fieldSize - finish.rank) / (finish.fieldSize - 1)
          : 1,
      ),
    ),
    averageTotal: average(completed.map(season => season.total)),
    averageVsField: average(completed.map(season => season.vsField)),
    bestSeason,
    worstSeason,
    picks: picks.length,
    averagePickRank: average(picks.map(pick => pick.leagueRank)),
    topThreeShare:
      picks.length > 0
        ? picks.filter(pick => pick.leagueRank <= 3).length / picks.length
        : null,
    bottomThreeShare:
      picks.length > 0
        ? picks.filter(pick => pick.leagueRank > pick.leagueSize - 3).length /
          picks.length
        : null,
    bestPickEver: extremes(picks, pick => pick.vsLeague).best,
    selfPicks: picks.filter(pick => pick.isSelf).length,
    current: running ? { ...running.finish, year: running.year } : null,
  };
}

/** The managers the member backed most, most picked first. */
export function buildFavoriteManagers(
  seasons: FSquaredSeason[],
): FSquaredFavoriteManager[] {
  const picks = seasons.flatMap(season =>
    season.picks.flatMap(pick =>
      pick.manager ? [{ ...pick, manager: pick.manager }] : [],
    ),
  );

  return Array.from(groupBy(picks, pick => pick.manager.id).values())
    .map(managerPicks => ({
      manager: managerPicks[0].manager,
      picks: managerPicks.length,
      years: Array.from(new Set(managerPicks.map(pick => pick.year))).sort(
        (a, b) => a - b,
      ),
      averageRank: average(managerPicks.map(pick => pick.leagueRank))!,
      averageVsLeague: average(managerPicks.map(pick => pick.vsLeague))!,
      isSelf: managerPicks[0].isSelf,
    }))
    .sort(
      (a, b) =>
        b.picks - a.picks ||
        a.averageRank - b.averageRank ||
        a.manager.discordName.localeCompare(b.manager.discordName),
    );
}

/**
 * The member's own teams as everyone else saw them: how many entries picked
 * each one, and who. A season nobody picked them still shows, as 0 of the
 * field - being passed over is part of the story too.
 */
export function buildPickedBy({
  userId,
  entries,
  teamStats,
  inProgressYear,
}: {
  userId: string;
  entries: FSquaredEntryRow[];
  teamStats: Map<string, TeamStats>;
  inProgressYear: number | null;
}): FSquaredPickedBy {
  const fieldSizes = new Map<number, number>();
  for (const entry of entries) {
    fieldSizes.set(entry.year, (fieldSizes.get(entry.year) ?? 0) + 1);
  }

  const seasons: FSquaredPickedBySeason[] = Array.from(teamStats.values())
    .filter(team => team.manager?.id === userId && fieldSizes.has(team.year))
    .map(team => {
      const fieldSize = fieldSizes.get(team.year)!;
      return {
        year: team.year,
        inProgress: team.year === inProgressYear,
        teamId: team.id,
        leagueName: team.leagueName,
        tier: team.tier,
        pointsFor: team.pointsFor,
        leagueRank: team.leagueRank,
        leagueSize: team.leagueSize,
        pickers: team.pickers
          .map(picker => ({ ...picker, isSelf: picker.id === userId }))
          .sort((a, b) => a.discordName.localeCompare(b.discordName)),
        fieldSize,
        share: team.pickers.length / fieldSize,
        popularityRank: team.popularityRank,
      };
    })
    .sort((a, b) => b.year - a.year || byLeague(a, b));

  const fans = seasons.flatMap(season =>
    season.pickers
      .filter(picker => !picker.isSelf)
      .map(picker => ({ picker, year: season.year })),
  );
  const topFans: FSquaredFan[] = Array.from(
    groupBy(fans, fan => fan.picker.id).values(),
  )
    .map(picks => {
      const { isSelf: _, ...member } = picks[0].picker;
      return {
        member,
        picks: picks.length,
        years: Array.from(new Set(picks.map(pick => pick.year))).sort(
          (a, b) => a - b,
        ),
      };
    })
    .sort(
      (a, b) =>
        b.picks - a.picks ||
        a.member.discordName.localeCompare(b.member.discordName),
    );

  let mostPicked: FSquaredPickedBySeason | null = null;
  for (const season of seasons) {
    // Seasons are newest first, so a tie goes to the more recent one.
    if (!mostPicked || season.share > mostPicked.share) mostPicked = season;
  }

  return {
    seasons,
    timesPicked: sum(seasons.map(season => season.pickers.length)),
    averageShare: average(seasons.map(season => season.share)),
    mostPicked,
    bestPopularityRank:
      seasons.length > 0
        ? Math.min(...seasons.map(season => season.popularityRank))
        : null,
    topFans,
  };
}

/** Everything the F² tab shows. */
export function buildFSquaredProfile({
  userId,
  teams,
  entries,
  inProgressYear,
  now,
}: {
  userId: string;
  teams: FSquaredTeamRow[];
  entries: FSquaredEntryRow[];
  inProgressYear: number | null;
  now: Date;
}) {
  const teamStats = buildTeamStats(teams, entries, now);
  const seasons = buildFSquaredSeasons({
    userId,
    entries,
    teamStats,
    inProgressYear,
  });

  return {
    seasons,
    career: seasons.length > 0 ? buildFSquaredCareer(seasons) : null,
    favoriteManagers: buildFavoriteManagers(seasons),
    pickedBy: buildPickedBy({ userId, entries, teamStats, inProgressYear }),
  };
}

export type FSquaredProfile = ReturnType<typeof buildFSquaredProfile>;
