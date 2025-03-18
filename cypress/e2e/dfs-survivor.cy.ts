describe('DFS Survivor', () => {
  const loginAsUserOne = () => {
    cy.clearCookie('_session');
    
    cy.loginAsUser(Cypress.env('userOne'));
    cy.getCookie('_session').should('exist');

    cy.navigateToDFSSurvivor();
    cy.wait(200);
  };

  const loginAsUserTwo = () => {
    cy.clearCookie('_session');
    
    cy.loginAsUser(Cypress.env('userTwo'));
    cy.getCookie('_session').should('exist');

    cy.navigateToDFSSurvivor();
    cy.wait(200);
  };

  // const loginAsAdmin = () => {
  //   cy.clearCookie('_session');
    
  //   cy.request({
  //     method: 'POST',
  //     url: '/api/test/login',
  //     body: {
  //       discordId: '123456789',  
  //       discordName: 'TestAdmin',
  //       discordAvatar: 'default_avatar',
  //       discordRoles: ['214097556051984385'] 
  //     }
  //   });

  //   cy.getCookie('_session').should('exist');
  //   cy.wait(100);
  // };

  const clearAllEntries = () => {
    cy.navigateToDFSSurvivor();

    openWeekCards();

    cy.get('input[type="text"].w-full').then($inputs => {

      const inputsArray = $inputs.toArray().reverse();
      
      inputsArray.forEach(input => {
        const $input = Cypress.$(input);
        const value = $input.val();
        
        if (value && value.toString().trim() !== '') {
          cy.wrap($input).clear();
          cy.wait(100);
        }
      });
      
      cy.get('button').contains('Save All Entries').click();
      cy.wait(100); 
      
      cy.url().should('include', '/games/dfs-survivor/entries');
    });
  };

  const clearEntriesUserOne = () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();
    clearAllEntries();
  };

  const clearEntriesUserTwo = () => {
    loginAsUserTwo();
    cy.navigateToDFSSurvivor();
    clearAllEntries();
  };

  // const clearEntriesAdmin = () => {
  //   loginAsAdmin();
  //   cy.navigateToDFSSurvivor();
  //   clearAllEntries();
  // };

  // const clearEntriesAllUsers = () => {
  //   clearEntriesUserOne();
  //   clearEntriesUserTwo();
  //   clearEntriesAdmin();
  // };

  const openWeekCards = () => {
    cy.wait(200);
    for (let week = 17; week >= 1; week--) {
      cy.contains(`Week ${week}`).click();
      cy.wait(100); 
    }
  };

  const enterPlayers = (playerSelections: Array<{week: number, index: number, name: string}>) => {
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name || ' ');
      cy.wait(100);
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(100);
    });

    const lastPlayerIndex = playerSelections[playerSelections.length - 1].index;

    cy.get('input[type="text"].w-full').eq(lastPlayerIndex).blur();
  };

  const saveEntry = (week: number) => {
    cy.get('button:contains("Save Entry")').then($buttons => {
      cy.wrap($buttons[week - 1]).click();
    });
    cy.wait(500);
  };

  const saveAllEntries = () => {
    cy.get('button').contains('Save All Entries').click();
    cy.wait(500);
  };

  const verifySuccessfulEntry = () => {
    cy.contains('Entries successfully submitted').should('be.visible');
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
  };

  const verifyFailedEntrySingleWeek = (playerName: string, week1: string, position1: string, position2: string) => {
    cy.contains(`Cannot select ${playerName} multiple times in week ${week1} (${position1}, ${position2})`).should('exist');
  };

  const verifyFailedEntryMultiWeek = (playerName: string, weeks: Array<number>) => {
    const weeksString = weeks.join(', ');
    cy.contains(`Cannot select ${playerName} in multiple weeks (${weeksString})`).should('exist');
  };

  const verifyFailedEntrySavedWeek = (playerName: string) => {
    cy.contains(`Player ${playerName} is already selected in another week`).should('exist');
  };

  const verifyPlayerEntries = (playerSelections: Array<{week: number, index: number, name: string}>) => {
    playerSelections.forEach(({  index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });
  };

  const verifyNoPlayersSaved = () => {
    cy.contains(`No players saved. Please try selecting the player from the dropdown.`).should('exist');
  };

  const verifyPlayerOnBye = (playerName: string, week: number) => {
    cy.contains(`Error: ${playerName} is on a bye week during week ${week}`).should('exist');
  };

  const getPlayerIndex = (week: number, position: string) => {

    const positionMap: Record<string, number> = {
      'QB1': 0,
      'QB2': 1,
      'RB1': 2,
      'RB2': 3,
      'WR1': 4,
      'WR2': 5,
      'TE': 6,
      'FLEX1': 7,
      'FLEX2': 8,
      'K': 9,
      'DEF': 10
    };
    

    if (!positionMap.hasOwnProperty(position)) {
      throw new Error(`Invalid position: ${position}`);
    }
    

    return positionMap[position] + (11 * (week - 1));
  };

  beforeEach(() => {

    cy.exec('docker exec -i flexspotff-postgres-1 psql -U postgres -d flexspotff < flexspot_backup_20250306_1636.sql', {
      timeout: 60000 
    });


    cy.on('uncaught:exception', (err) => {

      if (
        err.message.includes('Hydration failed') ||
        err.message.includes('There was an error while hydrating')
      ) {
        return false;
      }

      return true;
    });
  });

  /*
  TEST: Save Entry Functionality

  Purpose:
  - Test the ability to select a single player for a week and save the entry
  - Test the ability to select multiple players for a week and save the entry
  */
  it('Save Entry', () => {
    clearEntriesUserOne();

    // Test saving a player to a blank week
    const players = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Daniel Jones' },
    ];

    enterPlayers(players);
    saveEntry(1);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(players);

    // Test saving multiple players for a filled week
    const playersTwo = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Raheem Blackshear' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Rhamondre Stevenson' },
    ];

    enterPlayers(playersTwo);
    saveEntry(1);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersTwo);

    // Test overwriting a player in a filled week and adding a player
    const playersThree = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Justin Jefferson' },
    ];

    enterPlayers(playersThree);
    saveEntry(1);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersThree);

    // Test filling in players for two weeks and then saving one week
    const playersFour = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Aaron Jones' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Elijah Moore' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Nick Chubb' },
    ];

    const playersFourValidation = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Nick Chubb' },
    ];

    enterPlayers(playersFour);
    saveEntry(2);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersFourValidation);

    // Test filling out a full week
    const playersFive = [
      { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'CHI' },
      { week: 3, index: getPlayerIndex(3, 'K'), name: 'Harrison Butker' },
      { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Justin Watson' },
      { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Amon-Ra St. Brown' },
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Cole Kmet' },
      { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jameson Williams' },
      { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Tim Patrick' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'Jahmyr Gibbs' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'David Montgomery' },
      { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Jared Goff' },
      { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Josh Allen' }
    ];

    enterPlayers(playersFive);
    saveEntry(3);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersFive);
  });

  /*
  TEST: Save All Entries Functionality

  Purpose:
  - Test the ability to select a single player for a week and save the entry
  - Test the ability to select multiple players for a week and save the entry
  */
  it('Save All Entries', () => {
    clearEntriesUserOne();

    // Test saving a player to a blank week
    const players = [
      { week: 10, index: getPlayerIndex(10, 'WR1'), name: 'Jahan Dotson' },
      { week: 9, index: getPlayerIndex(9, 'DEF'), name: 'ATL' },
    ];

    enterPlayers(players);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(players);

    // Test saving multiple players for a filled week
    const playersTwo = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: 'Jerome Ford' },
      { week: 9, index: getPlayerIndex(9, 'RB2'), name: 'Raheem Mostert' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Justin Jefferson' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Dyami Brown' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Travis Kelce' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Christian McCaffrey' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: 'Justin Tucker' }
    ];

    enterPlayers(playersTwo);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersTwo);
    verifyPlayerEntries(players);

    // Test overwriting multiple players in filled weeks
    const playersThree = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: 'Kenneth Gainwell' },
      { week: 10, index: getPlayerIndex(10, 'WR1'), name: 'Garrett Wilson' },
      { week: 9, index: getPlayerIndex(9, 'RB2'), name: 'Raheem Mostert' },
    ];

    enterPlayers(playersThree);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersThree);

    // Test Deleting a player and adding a player in the same week
    const playersFour = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: '' },
      { week: 9, index: getPlayerIndex(9, 'FLEX2'), name: 'Sam LaPorta' },
    ];

    enterPlayers(playersFour);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersFour);
  });

  /*
  TEST: Invalid Player Name Entry

  Purpose:
  - test the limits of what is allowed in the player name field and what registers as a player name
  */
  it('Invalid Player Names', () => {
    clearEntriesUserOne();

    const entryPlayers = [
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'Detroit Lions', description: 'team name' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Invalid Player XYZ', description: 'non-existent player' },
      { week: 1, index: getPlayerIndex(1, 'K'), name: 'HaRrIson bUtKer', description: 'improper capitalization' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'JOSH JACOBS', description: 'all caps' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'aaron jones', description: 'lowercase' },
      { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Trey  McBride', description: 'double space' },
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Tim Patrick1', description: 'number suffix' },
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'T14i342m Jon132es38129371884', description: 'numbers in name' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Alvin Kamara38129371884', description: 'number suffix' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Kyren William$', description: 'special character' }
    ];

    const validPlayers = [
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'DET', description: 'team name' },
      { week: 1, index: getPlayerIndex(1, 'K'), name: 'Harrison Butker', description: 'improper capitalization' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Josh Jacobs', description: 'all caps' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Aaron Jones', description: 'lowercase' },
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Tim Patrick', description: 'number suffix' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Alvin Kamara', description: 'number suffix' },
    ]

    enterPlayers(entryPlayers);
    saveEntry(1);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(validPlayers);
  });

  /*
  TEST: Duplicate Tests with Save Entry

  Purpose:
  - Test that the same player cannot be selected multiple times in the same week
  - Test that the same player cannot be selected multiple times across different weeks
  */
  it('Save Entry Duplicate Players', () => {
    clearEntriesUserOne();

    // Test that the same player cannot be selected multiple times in the same week
    const entryPlayers = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' }
    ];

    const validPlayers = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' }
    ]

    enterPlayers(entryPlayers);
    verifyFailedEntrySingleWeek('Josh Allen', '1', 'QB1', 'QB2');
    saveEntry(1);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);

    // Test that the same player cannot be selected multiple times across different weeks
    const entryPlayersTwo = [
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Gerald Everett' },
      { week: 10, index: getPlayerIndex(10, 'FLEX2'), name: 'Gerald Everett' },
    ]

    const validPlayersTwo = [
      { week: 3, index: getPlayerIndex(3, 'TE'), name: '' },
      { week: 10, index: getPlayerIndex(10, 'FLEX2'), name: 'Gerald Everett' },
    ]

    enterPlayers(entryPlayersTwo);
    saveEntry(10);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayersTwo);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in different week
    const entryPlayersThree = [
      { week: 5, index: getPlayerIndex(5, 'WR1'), name: 'Josh Reynolds' },
    ]

    enterPlayers(entryPlayersThree);
    saveEntry(5);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    const duplicatePlayersThree = [
      { week: 7, index: getPlayerIndex(7, 'FLEX1'), name: 'Josh Reynolds' },
    ]

    enterPlayers(duplicatePlayersThree);
    verifyFailedEntrySavedWeek('Josh Reynolds');
    saveEntry(7);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in this week
    const entryPlayersFour = [
      { week: 5, index: getPlayerIndex(5, 'FLEX1'), name: 'Josh Reynolds' },
    ]

    enterPlayers(entryPlayersFour);
    verifyFailedEntrySavedWeek('Josh Reynolds');
    saveEntry(5);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);
  });

  /*
  TEST: Duplicate Tests with Save All Entries

  Purpose:
  - Test that the same player cannot be selected multiple times in the same week
  - Test that the same player cannot be selected multiple times across different weeks
  */
  it('Save All Entries Duplicate Players', () => {
    clearEntriesUserOne();

    // Test that the same player cannot be selected multiple times in the same week
    const entryPlayers = [
      { week: 4, index: getPlayerIndex(4, 'FLEX2'), name: 'Alexander Mattison' },
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: 'Alexander Mattison' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: 'Jake Bates' }
    ];

    const validPlayers = [
      { week: 4, index: getPlayerIndex(4, 'FLEX2'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: '' }
    ]

    enterPlayers(entryPlayers);
    verifyFailedEntrySingleWeek('Alexander Mattison', '4', 'FLEX2', 'RB1');
    saveAllEntries();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);

    // Test that the same player cannot be selected multiple times across different weeks
    const entryPlayersTwo = [
      { week: 16, index: getPlayerIndex(16, 'QB1'), name: 'Bo Nix' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: 'Bo Nix' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Bo Nix' },
    ]

    const validPlayersTwo = [
      { week: 16, index: getPlayerIndex(16, 'QB1'), name: '' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
    ]

    enterPlayers(entryPlayersTwo);
    saveAllEntries();
    verifyFailedEntryMultiWeek('Bo Nix', [1, 16, 17]);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayersTwo);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in different week
    const entryPlayersThree = [
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'LAR' },
    ]

    enterPlayers(entryPlayersThree);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    const duplicatePlayersThree = [
      { week: 17, index: getPlayerIndex(17, 'DEF'), name: 'LAR' },
    ]

    enterPlayers(duplicatePlayersThree);
    verifyFailedEntrySavedWeek('LAR');
    saveAllEntries();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in this week
    const entryPlayersFour = [
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'Josh Jacobs' },
    ]

    enterPlayers(entryPlayersFour);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersFour);

    const duplicatePlayersFour = [
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Josh Jacobs' },
    ]

    enterPlayers(duplicatePlayersFour);
    verifyFailedEntrySavedWeek('Josh Jacobs');
    saveAllEntries();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersFour);
  });

  /*
  TEST: Position Restriction Validation

  Purpose:
  - Test that players can only be selected in their valid positions with the save entry button
  - Test that players can only be selected in their valid positions with the save all entries button
  */
  it('Position Restriction Validation', () => {
    clearEntriesUserOne();

    const entryPlayersQBs = [
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Josh Allen' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Lamar Jackson' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'Jared Goff' },
      { week: 6, index: getPlayerIndex(6, 'FLEX2'), name: 'Jalen Hurts' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Bo Nix' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'Jameis Winston' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Derek Carr' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'Hendon Hooker' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Jordan Love' },
    ]
    
    const entryPlayersRBs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Jeff Wilson' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'Jerome Ford' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Jermar Jefferson' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'Gus Edwards' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Ameer Abdullah' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'Isaiah Pacheco' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Kareem Hunt' },
    ]

    const entryPlayersWRs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Deebo Samuel' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'DeVonta Smith' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Devaughn Vele' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Nico Collins' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Stefon Diggs' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'David Bell' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Jahan Dotson' },
    ]

    const entryPlayersTEs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Taysom Hill' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'Adam Trautman' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'George Kittle' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Luke Musgrave' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'Tyler Kraft' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Tyler Conklin' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Cole Kmet' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Brevin Jordan' },
    ]

    const entryPlayersKs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Justin Tucker' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'Jake Elliott' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'Cairo Santos' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Nick Folk' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Austin Seibert' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Harrison Butker' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'Brandon McManus' },
      { week: 6, index: getPlayerIndex(6, 'FLEX2'), name: 'Brandon Aubrey' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Cameron Dicker' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: "Ka'imi Fairbairn" },
    ]

    const entryPlayersDefenses = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'ATL' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'LV' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'SEA' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'LAR' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'DET' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'SF' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'TEN' },
      { week: 6, index: getPlayerIndex(6, 'FLEX2'), name: 'NYJ' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'PHI' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'NYG' },
    ]
    

    const validPlayers = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'FLEX2'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: '' },
    ]

    enterPlayers(entryPlayersQBs);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersRBs);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersWRs);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersTEs);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersKs);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersDefenses);
    saveEntry(6);
    verifyNoPlayersSaved();
    saveAllEntries();
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);
  });

  /*
  TEST: No Shared Entries Between Users

  Purpose:
  - Test that data handling works correctly with user changes
  */
  it('Entries not visible to other users', () => {
    clearEntriesUserOne();
    clearEntriesUserTwo();

    loginAsUserOne();
    openWeekCards();

    // Test saving multiple players for user 1
    const playersUserOne = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: 'Jerome Ford' },
      { week: 9, index: getPlayerIndex(9, 'RB2'), name: 'Raheem Mostert' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Justin Jefferson' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Dyami Brown' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Travis Kelce' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Christian McCaffrey' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: 'Justin Tucker' }
    ];

    const playersUserOneBlank = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: '' },
      { week: 9, index: getPlayerIndex(9, 'RB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: '' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: '' }
    ]

    enterPlayers(playersUserOne);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersUserOne);

    loginAsUserTwo();
    openWeekCards();

    verifyPlayerEntries(playersUserOneBlank);

    // Test saving the same players in different spots for user 2
    const playersUserTwo = [
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: 'Jerome Ford' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'Raheem Mostert' },
      { week: 5, index: getPlayerIndex(5, 'QB1'), name: 'Josh Allen' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Saquon Barkley' },
      { week: 7, index: getPlayerIndex(7, 'WR1'), name: 'Justin Jefferson' },
      { week: 7, index: getPlayerIndex(7, 'FLEX2'), name: 'Dyami Brown' },
      { week: 7, index: getPlayerIndex(7, 'TE'), name: 'Travis Kelce' },
      { week: 14, index: getPlayerIndex(14, 'RB1'), name: 'Christian McCaffrey' },
      { week: 17, index: getPlayerIndex(17, 'K'), name: 'Justin Tucker' }
    ]

    const playersUserTwoBlank = [
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: '' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: '' },
      { week: 5, index: getPlayerIndex(5, 'QB1'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: '' },
      { week: 7, index: getPlayerIndex(7, 'WR1'), name: '' },
      { week: 7, index: getPlayerIndex(7, 'FLEX2'), name: '' },
      { week: 7, index: getPlayerIndex(7, 'TE'), name: '' },
      { week: 14, index: getPlayerIndex(14, 'RB1'), name: '' },
      { week: 17, index: getPlayerIndex(17, 'K'), name: '' }
    ]

    enterPlayers(playersUserTwo);
    saveAllEntries();
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersUserTwo);

    loginAsUserOne();
    openWeekCards();

    verifyPlayerEntries(playersUserTwoBlank);
    verifyPlayerEntries(playersUserOne);

    loginAsUserTwo();
    openWeekCards();

    verifyPlayerEntries(playersUserOneBlank);
    verifyPlayerEntries(playersUserTwo);
  });

  /*
  TEST: Bye Week Handling

  Purpose:
  - Test that a player cannot be selected in a week that they are on bye
  */
  it('Bye Week Handling', () => {
    clearEntriesUserOne();

    const playerEntries = [
      { week: 5,  index: getPlayerIndex(5, 'RB1'), name: 'Saquon Barkley' },
      { week: 5,  index: getPlayerIndex(5, 'FLEX2'), name: 'Amon-Ra St. Brown' },
      { week: 8,  index: getPlayerIndex(8, 'WR1'), name: 'Justin Jefferson' },
      { week: 10, index: getPlayerIndex(10, 'WR2'), name: 'George Pickens' },
    ]

    const playerEntriesActual = [
      { week: 5,  index: getPlayerIndex(5, 'RB1'), name: '' },
      { week: 5, index: getPlayerIndex(5, 'FLEX2'), name: '' },
      { week: 8,  index: getPlayerIndex(8, 'WR1'), name: '' },
      { week: 10, index: getPlayerIndex(10, 'WR2'), name: '' },
    ]

    enterPlayers(playerEntries);
    saveAllEntries();
    verifyPlayerOnBye('Saquon Barkley', 5);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(playerEntriesActual);
  });

  /*
  TEST: Scoring Validation

  Purpose:
  - Test that entries are scored correctly and scores are displayed properly
  */

  /*
  TEST: Standings Validation

  Purpose:
  - Test that standings are displayed correctly and update properly
  */
});