import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedActionData, useTypedLoaderData } from 'remix-typedjson';
import type { DFSSurvivorUserWeek, DFSSurvivorUserEntry, Season, Player } from '@prisma/client';
import DfsSurvivorWeekComponent from '~/components/layout/dfs-survivor/DfsSurvivorWeek';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { createDfsSurvivorYear, getDfsSurvivorYearByUserAndYear } from '~/models/dfssurvivoryear.server';
import { prisma } from '~/db.server';

type WeekWithEntries = DFSSurvivorUserWeek & {
  entries: (DFSSurvivorUserEntry & {
    player: Player;
  })[];
};

type LoaderData = 
  | { isOpen: false; currentSeason: Season | null }
  | { 
      isOpen: true; 
      currentSeason: Season; 
      dfsSurvivorWeeks: WeekWithEntries[];
      availablePlayers: {
        QB: Player[];
        RB: Player[];
        WR: Player[];
        TE: Player[];
        K: Player[];
        DST: Player[];
        FLX: Player[];
      };
    };

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const formData = await request.formData();
  const weekId = formData.get('weekId');

  if (typeof weekId !== 'string') {
    throw new Error('Invalid form data');
  }

  // Get the week to ensure it exists and belongs to the user
  const week = await prisma.dFSSurvivorUserWeek.findUnique({
    where: { id: weekId },
    include: { userYear: true }
  });

  if (!week || week.userYear.userId !== user.id) {
    throw new Error('Invalid week or unauthorized');
  }

  // Process all entries from the form
  const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'D/ST'];
  
  for (const position of positions) {
    const playerId = formData.get(`playerId-${position}`);
    if (typeof playerId !== 'string' || !playerId) continue;

    // Get the player and their team
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { currentNFLTeam: true }
    });

    if (!player || !player.currentNFLTeam) {
      throw new Error(`Player not found or no team found for position ${position}`);
    }

    // Get the NFL game for this week and team
    const nflGame = await prisma.nFLGame.findFirst({
      where: {
        week: week.week,
        year: week.year,
        OR: [
          { homeTeamId: player.currentNFLTeam.id },
          { awayTeamId: player.currentNFLTeam.id }
        ]
      }
    });

    if (!nflGame) {
      throw new Error(`No game found for player ${player.fullName} in week ${week.week}`);
    }

    // Create or update the entry
    await prisma.dFSSurvivorUserEntry.upsert({
      where: {
        id: `${user.id}-${week.year}-${week.week}-${position}`
      },
      create: {
        id: `${user.id}-${week.year}-${week.week}-${position}`,
        userId: user.id,
        year: week.year,
        week: week.week,
        nflGameId: nflGame.id,
        playerId: player.id,
        points: 0,
        position: position
      },
      update: {
        nflGameId: nflGame.id,
        playerId: player.id,
        points: 0 // Reset points when changing player
      }
    });
  }

  return typedjson({ message: 'Entries saved successfully' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  let currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason: null });
  }

  if (!currentSeason.isOpenForDFSSurvivor) {
    return typedjson<LoaderData>({ isOpen: false, currentSeason });
  }

  // Get or create DFS Survivor year for the user
  let dfsSurvivorYear = await getDfsSurvivorYearByUserAndYear(user.id, currentSeason.year);
  if (!dfsSurvivorYear) {
    dfsSurvivorYear = await createDfsSurvivorYear(user.id, currentSeason.year);
  }

  // Get all entries for the user in this year to filter out already selected players
  const allEntries = await prisma.dFSSurvivorUserEntry.findMany({
    where: {
      userId: user.id,
      year: currentSeason.year
    },
    select: {
      playerId: true,
      week: true
    }
  });

  // Create a set of player IDs that are already selected
  const selectedPlayerIds = new Set(allEntries.map(entry => entry.playerId));

  // Fetch available players for each position
  const [qbPlayers, rbPlayers, wrPlayers, tePlayers, kPlayers, dstPlayers] = await Promise.all([
    prisma.player.findMany({
      where: { position: 'QB' },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { position: 'RB' },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { position: 'WR' },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { position: 'TE' },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { position: 'K' },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { position: 'DST' },
      orderBy: { fullName: 'asc' }
    })
  ]);

  // Filter out already selected players
  const filterSelectedPlayers = (players: Player[]) => 
    players.filter(player => !selectedPlayerIds.has(player.id));

  // Create FLEX players list (RB, WR, TE combined)
  const flexPlayers = [...rbPlayers, ...wrPlayers, ...tePlayers]
    .filter(player => !selectedPlayerIds.has(player.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Get the DFS Survivor year with entries and player information
  const dfsSurvivorYearWithEntries = await prisma.dFSSurvivorUserYear.findUnique({
    where: { id: dfsSurvivorYear.id },
    include: {
      weeks: {
        include: {
          entries: {
            include: {
              player: true
            }
          }
        }
      }
    }
  });

  return typedjson<LoaderData>({ 
    dfsSurvivorWeeks: dfsSurvivorYearWithEntries?.weeks || [], 
    currentSeason, 
    isOpen: true,
    availablePlayers: {
      QB: filterSelectedPlayers(qbPlayers),
      RB: filterSelectedPlayers(rbPlayers),
      WR: filterSelectedPlayers(wrPlayers),
      TE: filterSelectedPlayers(tePlayers),
      K: filterSelectedPlayers(kPlayers),
      DST: filterSelectedPlayers(dstPlayers),
      FLX: flexPlayers
    }
  });
};

export default function GamesDfsSurvivorMyEntry() {
  const data = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  if (!data.currentSeason) {
    return (
      <div>
        <h2>Season Not Available</h2>
        <p>Season is currently not available.</p>
      </div>
    );
  }

  if (!data.isOpen) {
    return (
      <div>
        <h2>DFS Survivor Closed</h2>
        <p>DFS survivor is currently closed for the season.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>My DFS Survivor Entries</h2>
      <div className="space-y-4">
        {actionData?.message && (
          <div>{actionData.message}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.dfsSurvivorWeeks.map((week) => (
            <DfsSurvivorWeekComponent 
              key={week.id} 
              week={week} 
              availablePlayers={data.availablePlayers}
              isSaving={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
