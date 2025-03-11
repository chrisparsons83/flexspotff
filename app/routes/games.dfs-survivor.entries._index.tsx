import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedActionData, useTypedLoaderData } from 'remix-typedjson';
import type { DFSSurvivorUserWeek, DFSSurvivorUserEntry, Season, Player } from '@prisma/client';
import DfsSurvivorWeekComponent from '~/components/layout/dfs-survivor/DfsSurvivorWeek';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';
import { createDfsSurvivorYear, getDfsSurvivorYearByUserAndYear } from '~/models/dfssurvivoryear.server';
import { prisma } from '~/db.server';
import Button from '~/components/ui/Button';
import { useState } from 'react';

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
        DEF: Player[];
        FLX: Player[];
      };
    };

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });

  const formData = await request.formData();
  const weeks = formData.getAll('weekId');

  for (const weekId of weeks) {
    if (typeof weekId !== 'string') continue;

    const week = await prisma.dFSSurvivorUserWeek.findUnique({
      where: { id: weekId },
      include: { userYear: true }
    });

    if (!week || week.userYear.userId !== user.id) {
      throw new Error('Invalid week or unauthorized');
    }

    const positions = ['QB1', 'QB2', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX1', 'FLEX2', 'K', 'DEF'];
    
    for (const position of positions) {
      const searchPosition = position === 'DEF' ? position : position.replace(/[12]/, '');
      const playerId = formData.get(`playerId-${weekId}-${position}`);
      
      // If playerId is empty string or not provided, delete any existing entry
      if (typeof playerId !== 'string' || !playerId) {
        await prisma.dFSSurvivorUserEntry.deleteMany({
          where: {
            userId: user.id,
            year: week.year,
            week: week.week,
            position: position
          }
        });
        continue;
      }

      const player = await prisma.player.findUnique({
        where: { 
          id: playerId,
        },
        include: { currentNFLTeam: true }
      });

      if (!player?.currentNFLTeam) {
        throw new Error(`Player not found or no team found for position ${searchPosition}`);
      }

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

      // First try to find an existing entry
      const existingEntry = await prisma.dFSSurvivorUserEntry.findFirst({
        where: {
          userId: user.id,
          year: week.year,
          week: week.week,
          position: position
        }
      });

      if (existingEntry) {
        // Update existing entry
        await prisma.dFSSurvivorUserEntry.update({
          where: { id: existingEntry.id },
          data: {
            nflGameId: nflGame.id,
            playerId: player.id,
            points: 0
          }
        });
      } else {
        // Create new entry
        await prisma.dFSSurvivorUserEntry.create({
          data: {
            userId: user.id,
            year: week.year,
            week: week.week,
            nflGameId: nflGame.id,
            playerId: player.id,
            points: 0,
            position: position
          }
        });
      }
    }
  }

  return typedjson({ message: 'Entries saved successfully' });
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

  let dfsSurvivorYear = await getDfsSurvivorYearByUserAndYear(user.id, currentSeason.year);
  if (!dfsSurvivorYear) {
    dfsSurvivorYear = await createDfsSurvivorYear(user.id, currentSeason.year);
  }

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

  const selectedPlayerIds = new Set(allEntries.map(entry => entry.playerId));

  const [qbPlayers, rbPlayers, wrPlayers, tePlayers, kPlayers, dstPlayers] = await Promise.all([
    prisma.player.findMany({
      where: { 
        position: 'QB',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'RB',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'WR',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'TE',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'K',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    }),
    prisma.player.findMany({
      where: { 
        position: 'DEF',
        currentNFLTeamId: { not: null }
      },
      orderBy: { fullName: 'asc' }
    })
  ]);

  const filterSelectedPlayers = (players: Player[]) => 
    players.filter(player => !selectedPlayerIds.has(player.id));

  const flexPlayers = [...rbPlayers, ...wrPlayers, ...tePlayers]
    .filter(player => !selectedPlayerIds.has(player.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

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
      DEF: filterSelectedPlayers(dstPlayers),
      FLX: flexPlayers
    }
  });
};

export default function GamesDfsSurvivorMyEntry() {
  const data = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const [error, setError] = useState<string | null>(null);

  const checkForDuplicatePlayers = () => {
    const selectedPlayers = new Set<string>();
    const inputs = document.querySelectorAll('input[name^="playerId-"]');
    
    for (const input of inputs) {
      const playerId = (input as HTMLInputElement).value;
      if (playerId && selectedPlayers.has(playerId)) {
        return true;
      }
      if (playerId) {
        selectedPlayers.add(playerId);
      }
    }
    return false;
  };

  const handleSaveAll = () => {
    if (checkForDuplicatePlayers()) {
      setError('Cannot save entries: A player has been selected multiple times');
    } else {
      setError(null);
      // Collect all form data and submit
      const formData = new FormData();
      const inputs = document.querySelectorAll('input[name^="playerId-"]');
      inputs.forEach(input => {
        formData.append((input as HTMLInputElement).name, (input as HTMLInputElement).value);
      });
      const weekInputs = document.querySelectorAll('input[name="weekId"]');
      weekInputs.forEach(input => {
        formData.append('weekId', (input as HTMLInputElement).value);
      });
      fetch(window.location.href, {
        method: 'POST',
        body: formData
      }).then(() => window.location.reload());
    }
  };

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
      {actionData?.message && actionData.message}
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="mb-4 flex justify-end">
        <Button type="button" onClick={handleSaveAll}>
          Save All Entries
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...data.dfsSurvivorWeeks].sort((a, b) => a.week - b.week).map((week) => (
          <DfsSurvivorWeekComponent 
            key={week.id} 
            week={week} 
            availablePlayers={data.availablePlayers}
            isSaving={false}
            formId={`week-${week.week}`}
          />
        ))}
      </div>
    </div>
  );
}
