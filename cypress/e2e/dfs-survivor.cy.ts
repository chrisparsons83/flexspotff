describe('DFS Survivor', () => {
  const loginAsUserOne = () => {
    // Clear any existing session
    cy.clearCookie('_session');
    
    // Login and verify
    cy.loginAsUser(Cypress.env('userOne'));
    cy.getCookie('_session').should('exist');
  };

  const loginAsUserTwo = () => {
    // Clear any existing session
    cy.clearCookie('_session');
    
    // Login and verify
    cy.loginAsUser(Cypress.env('userTwo'));
    cy.getCookie('_session').should('exist');
  };

  // const loginAsAdmin = () => {
  //   // Clear any existing session
  //   cy.clearCookie('_session');
    
  //   // Login as admin with required role
  //   cy.request({
  //     method: 'POST',
  //     url: '/api/test/login',
  //     body: {
  //       discordId: '123456789',  // Test admin Discord ID
  //       discordName: 'TestAdmin',
  //       discordAvatar: 'default_avatar',
  //       discordRoles: ['214097556051984385'] // SERVER_DISCORD_ADMIN_ROLE_ID
  //     }
  //   });

  //   // Verify session exists
  //   cy.getCookie('_session').should('exist');
  // };

  const clearAllEntries = () => {
    // Navigate to entries page
    cy.navigateToDFSSurvivor();

    openWeekCards();

    // Get all input fields and store them in an array
    cy.get('input[type="text"].w-full').then($inputs => {
      // Convert jQuery collection to array and reverse it to start from the last input
      const inputsArray = $inputs.toArray().reverse();
      
      // Process each input in reverse order
      inputsArray.forEach(input => {
        const $input = Cypress.$(input);
        const value = $input.val();
        
        // Only clear fields that have values
        if (value && value.toString().trim() !== '') {
          cy.wrap($input).clear();
          cy.wait(100);
        }
      });
      
      // Click Save All Entries and wait for save to complete
      cy.get('button').contains('Save All Entries').click();
      cy.wait(100); // Longer wait to ensure save completes
      
      // Wait for the page to reload
      cy.url().should('include', '/games/dfs-survivor/entries');
    });
  };

  const clearEntriesUserOne = () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();
    clearAllEntries();
  };

  // const clearEntriesUserTwo = () => {
  //   loginAsUserTwo();
  //   cy.navigateToDFSSurvivor();
  //   clearAllEntries();
  // };

  // const clearEntriesAllUsers = () => {
  //   clearEntriesUserOne();
  //   clearEntriesUserTwo();
  // };

  const openWeekCards = () => {
    for (let week = 17; week >= 1; week--) {
      cy.contains(`Week ${week}`).click();
      cy.wait(100); 
    }
  };

  const enterPlayers = (playerSelections: Array<{week: number, index: number, name: string}>) => {
    playerSelections.forEach(({ week, index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name || ' ');
      cy.wait(100); // Add wait after typing
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(100); // Wait for any potential auto-complete/validation
    });
    // Click the position label of the last player to ensure dropdown closes
    const lastPlayerIndex = playerSelections[playerSelections.length - 1].index;
    // Directly trigger blur on the last field that was interacted with
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
    playerSelections.forEach(({ week, index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });
  };

  const getPlayerIndex = (week: number, position: string) => {
    // Position map for direct position-to-index mapping
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
    
    // Get the base position index or throw error if invalid position
    if (!positionMap.hasOwnProperty(position)) {
      throw new Error(`Invalid position: ${position}`);
    }
    
    // Calculate final index based on week
    return positionMap[position] + (11 * (week - 1));
  };

  beforeEach(() => {
    // Reset and load the database backup using Docker
    cy.exec('docker exec -i flexspotff-postgres-1 psql -U postgres -d flexspotff < flexspot_backup_20250306_1636.sql', {
      timeout: 60000 // Increase timeout to 60 seconds
    });

    // Ignore React hydration errors
    cy.on('uncaught:exception', (err) => {
      // Ignore both types of hydration errors we're seeing
      if (
        err.message.includes('Hydration failed') ||
        err.message.includes('There was an error while hydrating')
      ) {
        return false;
      }
      // Fail on other errors
      return true;
    });
  });

  /*
  TEST: Save Entry Functionality

  Purpose:
  - Test the ability to select a single player for a week and save the entry
  - Test the ability to select multiple players for a week and save the entry
  */
  it('Save Entry Tests', () => {
    loginAsUserOne();
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
  it('Save All Entries Tests', () => {
    loginAsUserOne();
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
  it('Invalid Player Name Tests', () => {
    loginAsUserOne();
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
  it('Save Entry Duplicate Player Tests', () => {
    loginAsUserOne();
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
  it('should prevent using same player across different weeks', () => {
    loginAsUserOne();
    clearEntriesUserOne();

    const entryPlayersOne = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
    ];

    const entryPlayersTwo = [
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Josh Allen' },
    ];

    const entryPlayerTwoResult = [
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: '' },
    ]
    
    enterPlayers(entryPlayersOne);
    saveEntry(1);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersOne);

    enterPlayers(entryPlayersTwo);
    saveEntry(2);

    cy.reload();
    openWeekCards();
    verifyPlayerEntries(entryPlayersOne);
    verifyPlayerEntries(entryPlayerTwoResult);
  });

  /*
  TEST: Cross-Week Duplicate Prevention with Save All Entries

  Purpose:
  - Test that the same player cannot be selected across multiple weeks when using Save All Entries
  - Verify that only the first instance of a duplicated player is saved
  - Verify that subsequent duplicate entries are cleared

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User selects Jerry Jeudy as WR1 in Week 1
  - User selects Jerry Jeudy as WR2 in Week 4
  - User selects Jerry Jeudy as FLEX1 in Week 6
  - User clicks Save All Entries button
  - User verifies error message about duplicate player
  - User verifies only first instance is saved
  - User verifies subsequent entries are cleared

  Expected Results:
  - Error message should indicate Jerry Jeudy is selected multiple times
  - Only the first instance (Week 1 WR1) should be saved
  - Other instances (Week 4 WR2 and Week 6 FLEX1) should be cleared
  - Save operation should complete with partial success
  */
  it('should prevent using same player across different weeks when using Save All Entries', () => {
    loginAsUserOne();
    clearEntriesUserOne();

    const entryPlayers = [
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'Jerry Jeudy' },
      { week: 4, index: getPlayerIndex(4, 'WR2'), name: 'Jerry Jeudy' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'Jerry Jeudy' },
    ]

    const validPlayers = [
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'WR2'), name: '' },
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: '' },
    ]

    enterPlayers(entryPlayers);
    saveAllEntries();
    verifyFailedEntryMultiWeek('Jerry Jeudy', [1, 4, 6]);

    cy.reload();
    openWeekCards();
    verifyPlayerEntries(validPlayers);
  });

  /*
  TEST: Position Restriction Validation

  Purpose:
  - Test that players can only be selected in their valid positions

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User opens Week 1
  - User attempts to select a QB (e.g., "Josh Allen") in an RB slot
  - User attempts to select a K (e.g., "Justin Tucker") in a FLEX slot
  - User attempts to save entries
  - User verifies invalid selections are prevented

  Expected Results:
  - QB should not be selectable in RB slot
  - K should not be selectable in FLEX slot
  - Error messages should indicate invalid position selections
  */
  it('should prevent players from being selected in invalid positions', () => {
    loginAsUserOne();
    clearEntriesUserOne();

    const entryPlayers = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Justin Tucker' },
    ]

    const validPlayers = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: '' },
    ]

    enterPlayers(entryPlayers);
    saveEntry(1);

    cy.reload();
    openWeekCards();
    verifyPlayerEntries(validPlayers);

  });

  /*
  TEST: Browser Refresh Data Persistence

  Purpose:
  - Test that saved data persists correctly after page refresh

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User fills out Week 1 entries
  - User saves entries
  - User refreshes browser
  - User verifies all saved entries are present
  - User fills out Week 2 entries
  - User refreshes browser
  - User verifies all saved entries are present

  Expected Results:
  - Saved entries should persist after refresh
  - Unsaved changes should be handled according to spec
  - Form state should be correctly restored
  */
  it('should persist saved entries across browser refreshes', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Fill out Week 1 entries
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form
    cy.get('input[type="text"].w-full').should('be.visible');

    const week1Players = [
      { index: 0, name: 'Josh Allen' },
      { index: 2, name: 'Saquon Barkley' },
      { index: 4, name: 'Jerry Jeudy' }
    ];

    // Fill out Week 1 players with proper waits
    week1Players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50); // Wait after typing player name
    });

    // Ensure form is ready before saving Week 1
    cy.get('button').contains('Save Entry').should('be.visible').should('be.enabled');
    cy.get('button').contains('Save Entry').click();
    cy.wait(50);

    // Wait for save to complete
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Verify Week 1 entries persisted
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').should('be.visible');
    week1Players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    // Fill out Week 2 entries
    cy.get('[data-testid="week-2-form"]').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').should('be.visible');

    const week2Players = [
      { index: 11, name: 'Justin Jefferson' },
      { index: 13, name: 'Christian McCaffrey' }
    ];

    // Fill out Week 2 players with proper waits
    week2Players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50);
    });

    // Wait for save to complete and reload
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.reload();
    cy.wait(50);

    // Verify Week 1 entries still persist
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').should('be.visible');
    week1Players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    // Verify Week 2 entries persist
    cy.get('[data-testid="week-2-form"]').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').should('be.visible');
    week2Players.forEach(({ index }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', '');
    });

    clearAllEntries();
  });

  /*
  TEST: Session Management

  Purpose:
  - Test that data handling works correctly with session changes

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User1 fills and saves entries
  - User1 logs out
  - User2 logs in
  - User2 verifies no saved entries are present
  - User2 fills and saves entries
  - User2 logs out
  - User1 logs back in
  - User1 verifies saved entries are present
  - User1 logs out
  - User2 logs back in
  - User2 verifies saved entries are present

  Expected Results:
  - All saved data should persist across sessions
  - Form state should be correctly restored after login
  - User preferences should be maintained
  */

  it('should maintain data persistence across session changes', () => {
    // User One fills and saves entries
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    const user1Selections = [
      { week: 1, index: 0, name: 'Josh Allen' },
      { week: 1, index: 2, name: 'Saquon Barkley' },
      { week: 2, index: 16, name: 'Justin Jefferson' }
    ];

    // Fill out entries for User One
    cy.get('[data-testid="week-1-form"]').should('be.visible').click();
    cy.wait(50); // Wait after clicking week form
    cy.get('[data-testid="week-2-form"]').should('be.visible').click();
    cy.wait(50); // Wait after clicking week form
    user1Selections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').should('be.visible');
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50); // Wait after typing player name
    });

    // Save User One's entries
    cy.get('button').contains('Save All Entries').should('be.visible').should('be.enabled').click();
    cy.wait(50);
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Switch to User Two
    loginAsUserTwo();
    cy.navigateToDFSSurvivor();

    // Verify User Two sees no entries
    cy.get('[data-testid="week-1-form"]').should('be.visible').click();
    cy.wait(50);
    cy.get('[data-testid="week-2-form"]').should('be.visible').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').should('be.visible');
    cy.get('input[type="text"].w-full').eq(0).should('have.value', '');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', '');
    cy.get('input[type="text"].w-full').eq(16).should('have.value', '');
    // User Two makes their own entries
    const user2Selections = [
      { week: 1, index: 0, name: 'Patrick Mahomes' },
      { week: 1, index: 2, name: 'Christian McCaffrey' },
      { week: 2, index: 15, name: 'Justin Jefferson' }
    ];

    // Fill out entries for User Two
    user2Selections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').should('be.visible');
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50);
    });

    // Save User Two's entries
    cy.get('button').contains('Save Entry').should('be.visible').should('be.enabled').click();
    cy.wait(50);
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Switch back to User One
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Verify User One's entries are still present
    cy.get('[data-testid="week-1-form"]').should('be.visible').click();
    cy.wait(50);
    cy.get('[data-testid="week-2-form"]').should('be.visible').click();
    cy.wait(50);
    user1Selections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').should('be.visible');
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    // Switch back to User Two
    loginAsUserTwo();
    cy.navigateToDFSSurvivor();

    // Verify User Two's entries are still present
    // Fill out entries for User Two
    cy.get('[data-testid="week-1-form"]').should('be.visible').click();
    cy.wait(50);
    cy.get('[data-testid="week-2-form"]').should('be.visible').click();
    cy.wait(50);
    user2Selections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').should('be.visible');
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    clearAllEntries();
    loginAsUserOne();
    clearAllEntries();
  });

  /*
  TEST: Bye Week Handling

  Purpose:
  - Test that system properly handles players during bye weeks

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season
  - Known bye week schedule in database

  Test Steps:
  - User types in the name of a player who is on a bye week
  - User clicks the "Save Entry" button
  - User is warned that the player is on a bye week

  Expected Results:
  - System should prevent/warn about bye week selections
  - Error messages should clearly indicate bye week conflict
  - Other weeks' selections should remain unaffected
  */

  it('should handle bye week player selections correctly', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Known bye week players and their weeks
    const byeWeekSelections = [
      {
        week: 7, // Bills bye week
        players: [
          { index: 0, name: 'Josh Allen', expectError: true },
          { index: 2, name: 'Derrick Henry', expectError: false }
        ]
      },
      {
        week: 10, // Giants bye week
        players: [
          { index: 11, name: 'Saquon Barkley', expectError: true },
          { index: 13, name: 'Travis Kelce', expectError: false }
        ]
      }
    ];

    // Test each bye week scenario
    byeWeekSelections.forEach(({ week, players }) => {
      // Open week form
      cy.get(`[data-testid="week-${week}-form"]`).should('be.visible').click();
      cy.wait(50); // Wait after clicking week form
      cy.get('input[type="text"].w-full').should('be.visible');

      // Enter players
      players.forEach(({ index, name }) => {
        cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
        cy.wait(50); // Wait after typing player name
      });

      // Try to save the week
      cy.get('button').contains('Save Entry').should('be.visible').should('be.enabled').click();
      cy.wait(50);

      // Verify error messages for bye week players
      players.forEach(({ name, expectError }) => {
        if (expectError) {
          cy.contains(`Cannot save entries: Player ${name} is on bye for Week ${week}`).should('be.visible');
        }
      });

      // Refresh and verify saved state
      cy.reload();
      cy.wait(50);
      cy.get(`[data-testid="week-${week}-form"]`).should('be.visible').click();
      cy.wait(50);
      
      // Verify only non-bye week players were saved
      players.forEach(({ index, name, expectError }) => {
        if (expectError) {
          cy.get('input[type="text"].w-full').eq(index).should('have.value', '');
        } else {
          cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
        }
      });
    });

    // Verify other weeks weren't affected
    cy.get('[data-testid="week-1-form"]').should('be.visible').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').first().should('have.value', '');

    clearAllEntries();
  });
});
  

//Performance Tests:

/*
TEST: Full Season Entry Performance

Purpose:
- Test system performance with maximum data load

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season

Test Steps:
- User fills out all positions for all 17 weeks
- User verifies page load time remains acceptable
- User tests save operation performance
- User verifies UI responsiveness
- User tests navigation between weeks

Expected Results:
- Page should maintain responsive performance
- Save operations should complete within acceptable time
- UI should remain smooth when navigating filled weeks
- No significant degradation in system performance
*/

/*
TEST: Concurrent Save Operation Handling

Purpose:
- Test system behavior during multiple rapid save operations

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season

Test Steps:
- User fills multiple week entries
- User triggers rapid successive saves
- User verifies save operation integrity
- User verifies data consistency
- User verifies UI feedback accuracy

Expected Results:
- All save operations should complete correctly
- Data should remain consistent
- UI should provide accurate feedback
- No race conditions or data corruption
*/

//Scoring Tests:

/*
TEST: Position-Specific Scoring Verification

Purpose:
- Test that each position is scored correctly according to rules

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Week has been completed and stats are available

Test Steps:
- User verifies QB scoring (passing/rushing/receiving points)
- User verifies RB/WR scoring (rushing/receiving points)
- User verifies K scoring (field goals/extra points)
- User verifies DEF scoring (points allowed/turnovers)
- User verifies bonus point calculations

Expected Results:
- All positions should score according to rules
- Bonus points should be correctly applied
- Total scores should be accurately calculated
- Scoring should match official NFL statistics
*/

/*
TEST: Score Update Propagation

Purpose:
- Test that score updates properly propagate through the system

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Completed week with known stat corrections

Test Steps:
- User verifies initial scoring
- Admin applies stat correction
- User verifies score update propagation
- User verifies standings update
- User verifies historical record accuracy

Expected Results:
- Scores should update automatically
- Standings should reflect updated scores
- Historical records should maintain accuracy
- Users should be notified of significant changes
*/

//Mobile/Responsive Tests:

/*
TEST: Mobile Device Entry Form Usability

Purpose:
- Test entry form functionality on mobile devices

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Mobile device or emulator

Test Steps:
- User accesses form on mobile device
- User verifies all inputs are accessible
- User tests player selection interface
- User verifies save button accessibility
- User tests form submission process

Expected Results:
- All form elements should be properly sized
- Touch targets should be adequately sized
- Player selection should work smoothly
- Save operations should work reliably
*/

/*
TEST: Responsive Layout Breakpoints

Purpose:
- Test layout behavior across different screen sizes

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Various device sizes/orientations

Test Steps:
- User tests layout at mobile breakpoint
- User tests layout at tablet breakpoint
- User tests layout at desktop breakpoint
- User verifies orientation changes
- User verifies content readability

Expected Results:
- Layout should adapt appropriately to screen size
- Content should remain readable at all sizes
- Navigation should remain functional
- No horizontal scrolling on mobile
*/