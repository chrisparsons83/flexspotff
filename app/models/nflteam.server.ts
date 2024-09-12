import { prisma } from '~/db.server';

export type { NFLTeam } from '@prisma/client';

// TODO: Make this better.
export async function createNflTeams() {
  return prisma.nFLTeam.createMany({
    data: [
      {
        name: 'Buffalo Bills',
        location: 'Buffalo',
        mascot: 'Bills',
        sleeperId: 'BUF',
      },
      {
        name: 'Miami Dolphins',
        location: 'Miami',
        mascot: 'Dolphins',
        sleeperId: 'MIA',
      },
      {
        name: 'New England Patriots',
        location: 'New England',
        mascot: 'Patriots',
        sleeperId: 'NE',
      },
      {
        name: 'New York Jets',
        location: 'New York',
        mascot: 'Jets',
        sleeperId: 'NYJ',
      },
      {
        name: 'Baltimore Ravens',
        location: 'Baltimore',
        mascot: 'Ravens',
        sleeperId: 'BAL',
      },
      {
        name: 'Cincinnati Bengals',
        location: 'Cincinnati',
        mascot: 'Bengals',
        sleeperId: 'CIN',
      },
      {
        name: 'Cleveland Browns',
        location: 'Cleveland',
        mascot: 'Browns',
        sleeperId: 'CLE',
      },
      {
        name: 'Pittsburgh Steelers',
        location: 'Pittsburgh',
        mascot: 'Steelers',
        sleeperId: 'PIT',
      },
      {
        name: 'Houston Texans',
        location: 'Houston',
        mascot: 'Texans',
        sleeperId: 'HOU',
      },
      {
        name: 'Indianapolis Colts',
        location: 'Indianapolis',
        mascot: 'Colts',
        sleeperId: 'IND',
      },
      {
        name: 'Jacksonville Jaguars',
        location: 'Jacksonville',
        mascot: 'Jaguars',
        sleeperId: 'JAX',
      },
      {
        name: 'Tennessee Titans',
        location: 'Tennessee',
        mascot: 'Titans',
        sleeperId: 'TEN',
      },
      {
        name: 'Denver Broncos',
        location: 'Denver',
        mascot: 'Broncos',
        sleeperId: 'DEN',
      },
      {
        name: 'Kansas City Chiefs',
        location: 'Kansas City',
        mascot: 'Chiefs',
        sleeperId: 'KC',
      },
      {
        name: 'Las Vegas Raiders',
        location: 'Las Vegas',
        mascot: 'Raiders',
        sleeperId: 'LV',
      },
      {
        name: 'Los Angeles Chargers',
        location: 'Los Angeles',
        mascot: 'Chargers',
        sleeperId: 'LAC',
      },
      {
        name: 'Dallas Cowboys',
        location: 'Dallas',
        mascot: 'Cowboys',
        sleeperId: 'DAL',
      },
      {
        name: 'New York Giants',
        location: 'New York',
        mascot: 'Giants',
        sleeperId: 'NYG',
      },
      {
        name: 'Philadelphia Eagles',
        location: 'Philadelphia',
        mascot: 'Eagles',
        sleeperId: 'PHI',
      },
      {
        name: 'Washington Commanders',
        location: 'Washington',
        mascot: 'Commanders',
        sleeperId: 'WAS',
      },
      {
        name: 'Chicago Bears',
        location: 'Chicago',
        mascot: 'Bears',
        sleeperId: 'CHI',
      },
      {
        name: 'Detroit Lions',
        location: 'Detroit',
        mascot: 'Lions',
        sleeperId: 'DET',
      },
      {
        name: 'Green Bay Packers',
        location: 'Green Bay',
        mascot: 'Packers',
        sleeperId: 'GB',
      },
      {
        name: 'Minnesota Vikings',
        location: 'Minnesota',
        mascot: 'Vikings',
        sleeperId: 'MIN',
      },
      {
        name: 'Atlanta Falcons',
        location: 'Atlanta',
        mascot: 'Falcons',
        sleeperId: 'ATL',
      },
      {
        name: 'Carolina Panthers',
        location: 'Carolina',
        mascot: 'Panthers',
        sleeperId: 'CAR',
      },
      {
        name: 'New Orleans Saints',
        location: 'New Orleans',
        mascot: 'Saints',
        sleeperId: 'NO',
      },
      {
        name: 'Tampa Bay Buccaneers',
        location: 'Tampa Bay',
        mascot: 'Buccaneers',
        sleeperId: 'TB',
      },
      {
        name: 'Arizona Cardinals',
        location: 'Arizona',
        mascot: 'Cardinals',
        sleeperId: 'ARI',
      },
      {
        name: 'Los Angeles Rams',
        location: 'Los Angeles',
        mascot: 'Rams',
        sleeperId: 'LAR',
      },
      {
        name: 'San Francisco 49ers',
        location: 'San Francisco',
        mascot: '49ers',
        sleeperId: 'SF',
      },
      {
        name: 'Seattle Seahawks',
        location: 'Seattle',
        mascot: 'Seahawks',
        sleeperId: 'SEA',
      },
    ],
    skipDuplicates: true,
  });
}

export async function getNflTeams() {
  return prisma.nFLTeam.findMany({});
}
