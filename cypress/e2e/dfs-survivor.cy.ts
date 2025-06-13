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

  const loginAsAdmin = () => {
    cy.clearCookie('_session');


    cy.request({
      method: 'POST',
      url: '/api/test/login',
      body: {
        discordId: '123456789',
        discordId: '123456789',
        discordName: 'TestAdmin',
        discordAvatar: 'default_avatar',
        discordRoles: ['214097556051984385'],
      },
    });

    cy.getCookie('_session').should('exist');
    cy.wait(100);

    cy.navigateToDFSSurvivor();
    cy.wait(200);
  };

  const clearAllEntries = () => {
    navigateWithMockTime(new Date('2024-08-06T00:19:00Z'));

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
    unscoreAllWeeks();
    loginAsUserOne();
    navigateWithMockTime(new Date('2024-08-06T00:19:00Z'));
    clearAllEntries();
  };

  const clearEntriesUserTwo = () => {
    unscoreAllWeeks();
    loginAsUserTwo();
    navigateWithMockTime(new Date('2024-08-06T00:19:00Z'));
    clearAllEntries();
  };

  const clearEntriesAdmin = () => {
    loginAsAdmin();
    cy.navigateToDFSSurvivor();
    clearAllEntries();
  };

  const clearEntriesAllUsers = () => {
    clearEntriesUserOne();
    clearEntriesUserTwo();
    clearEntriesAdmin();
  };

  const openWeekCards = () => {
    cy.wait(200);
    for (let week = 17; week >= 1; week--) {
      cy.contains(`Week ${week}`).click();
      cy.wait(100);
    }
  };

  const enterPlayers = (
    playerSelections: Array<{ week: number; index: number; name: string }>,
  ) => {
    //Set time to an hour before week 1 of the 2024 NFL season
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full')
        .eq(index)
        .clear()
        .type(name || ' ');
      cy.wait(100);
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(100);
    });

    const lastPlayerIndex = playerSelections[playerSelections.length - 1].index;

    cy.get('input[type="text"].w-full').eq(lastPlayerIndex).blur();
  };

  const saveEntry = (week: number, testTime: Date) => {
    setMockTime(testTime);
    cy.get('button:contains("Save Entry")').then($buttons => {
      cy.wrap($buttons[week - 1]).click();
    });
    cy.wait(500);
  };

  const saveAllEntries = (testTime: Date) => {
    setMockTime(testTime);
    cy.get('button').contains('Save All Entries').click();
    cy.wait(500);
  };

  const verifySuccessfulEntry = () => {
    cy.contains('Entries successfully submitted').should('be.visible');
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
  };

  const verifyFailedEntrySingleWeek = (
    playerName: string,
    week1: string,
    position1: string,
    position2: string,
  ) => {
    cy.contains(
      `Cannot select ${playerName} multiple times in week ${week1} (${position1}, ${position2})`,
    ).should('exist');
  };

  const verifyFailedEntryMultiWeek = (
    playerName: string,
    weeks: Array<number>,
  ) => {
    const weeksString = weeks.join(', ');
    cy.contains(
      `Cannot select ${playerName} in multiple weeks (${weeksString})`,
    ).should('exist');
  };

  const verifyFailedEntrySavedWeek = (playerName: string) => {
    cy.contains(
      `Player ${playerName} is already selected in another week`,
    ).should('exist');
  };

  const verifyPlayerEntries = (
    playerSelections: Array<{ week: number; index: number; name: string }>,
  ) => {
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });
  };

  const verifyNoPlayersSaved = () => {
    cy.contains(
      `No players saved. Please try selecting the player from the dropdown.`,
    ).should('exist');
  };

  const verifyPlayerOnBye = (playerName: string, week: number) => {
    cy.contains(
      `Error: ${playerName} is on a bye week during week ${week}`,
    ).should('exist');
  };

  const setMockTime = (date: Date) => {
    const mockTime = Cypress.env('TIME_MOCK_SECRET') + ':' + date.toISOString();
    cy.get('form[id^="week-"]').each($form => {
      cy.wrap($form).invoke(
        'append',
        `<input type="hidden" name="__test_current_time__" value="${mockTime}" />`,
      );
    });
    cy.wait(100);
  };

  const navigateWithMockTime = (date: Date) => {
    const mockTime = Cypress.env('TIME_MOCK_SECRET') + ':' + date.toISOString();
    cy.visit(
      `/games/dfs-survivor/entries?__test_current_time__=${encodeURIComponent(
        mockTime,
      )}`,
      { failOnStatusCode: false },
    );
    cy.url().should('include', '/games/dfs-survivor/entries');
  };

  const unscoreAllWeeks = () => {
    loginAsAdmin();
    // Click on user icon in top right (Menu.Button with rounded-full class)
    cy.navigateToDFSSurvivorAdmin();

    // Use a recursive approach to handle DOM updates
    const revertScoredWeeks = () => {
      cy.get('table tbody tr').then($rows => {
        let foundScoredWeek = false;

        // Check each row for "Revert Scoring" button
        $rows.each((index, row) => {
          const $button = Cypress.$(row).find('button');
          if (
            $button.length > 0 &&
            $button.text().trim() === 'Revert Scoring'
          ) {
            foundScoredWeek = true;
            // Click the first "Revert Scoring" button found
            cy.wrap($button).click();
            cy.wait(1000); // Wait for the page to update
            return false; // Break out of the each loop
          }
        });

        // If we found and clicked a scored week, recursively check again
        if (foundScoredWeek) {
          revertScoredWeeks();
        }
      });
    };

    revertScoredWeeks();
  };

  const getPlayerIndex = (week: number, position: string) => {
    const positionMap: Record<string, number> = {
      QB1: 0,
      QB2: 1,
      RB1: 2,
      RB2: 3,
      WR1: 4,
      WR2: 5,
      TE: 6,
      FLEX1: 7,
      FLEX2: 8,
      K: 9,
      DEF: 10,
    };

    if (!positionMap.hasOwnProperty(position)) {
      throw new Error(`Invalid position: ${position}`);
    }

    return positionMap[position] + 11 * (week - 1);
  };

  beforeEach(() => {
    cy.exec(
      'docker exec -i flexspotff-postgres-1 psql -U postgres -d flexspotff < flexspot_backup_20250306_1636.sql',
      {
        timeout: 60000,
      },
    );

    cy.on('uncaught:exception', err => {
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
    const testTime = new Date('2024-09-06T00:19:00Z');

    clearEntriesUserOne();

    // Test saving a player to a blank week
    const players = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
    ];

    enterPlayers(players);
    saveEntry(1, testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(players);

    // Test saving multiple players for a filled week
    const playersTwo = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Rhamondre Stevenson' },
    ];

    const testTimeTwo = new Date('2024-09-07T00:14:59Z');

    enterPlayers(playersTwo);
    saveEntry(1, testTimeTwo);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersTwo);

    // Test overwriting a player in a filled week and adding a player
    const playersThree = [
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Raheem Blackshear' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Justin Jefferson' },
    ];

    enterPlayers(playersThree);
    saveEntry(1, testTime);
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
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Raheem Blackshear' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Nick Chubb' },
    ];

    enterPlayers(playersFour);
    saveEntry(2, testTime);
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
      { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Josh Allen' },
    ];

    enterPlayers(playersFive);
    saveEntry(3, testTime);
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
    const testTime = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    // Test saving a player to a blank week
    const players = [
      { week: 10, index: getPlayerIndex(10, 'WR1'), name: 'Jahan Dotson' },
      { week: 9, index: getPlayerIndex(9, 'DEF'), name: 'ATL' },
    ];
    enterPlayers(playerEntriesOne);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesOne);

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
      { week: 4, index: getPlayerIndex(4, 'K'), name: 'Justin Tucker' },
    ];

    enterPlayers(playersTwo);
    saveAllEntries(testTime);
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
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playersThree);

    // Test Deleting a player and adding a player in the same week
    const playersFour = [
      { week: 9, index: getPlayerIndex(9, 'RB1'), name: '' },
      { week: 9, index: getPlayerIndex(9, 'FLEX2'), name: 'Sam LaPorta' },
    ];

    enterPlayers(playersFour);
    saveAllEntries(testTime);
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
    const testTime = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    const entryPlayers = [
      {
        week: 1,
        index: getPlayerIndex(1, 'DEF'),
        name: 'Detroit Lions',
        description: 'team name',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'QB1'),
        name: 'Invalid Player XYZ',
        description: 'non-existent player',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'K'),
        name: 'HaRrIson bUtKer',
        description: 'improper capitalization',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'FLEX2'),
        name: 'JOSH JACOBS',
        description: 'all caps',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'FLEX1'),
        name: 'aaron jones',
        description: 'lowercase',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'TE'),
        name: 'Trey  McBride',
        description: 'double space',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'WR2'),
        name: 'Tim Patrick1',
        description: 'number suffix',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'WR1'),
        name: 'T14i342m Jon132es38129371884',
        description: 'numbers in name',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'RB2'),
        name: 'Alvin Kamara38129371884',
        description: 'number suffix',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'RB1'),
        name: 'Kyren William$',
        description: 'special character',
      },
    ];

    const validPlayers = [
      {
        week: 1,
        index: getPlayerIndex(1, 'DEF'),
        name: 'DET',
        description: 'team name',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'K'),
        name: 'Harrison Butker',
        description: 'improper capitalization',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'FLEX2'),
        name: 'Josh Jacobs',
        description: 'all caps',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'FLEX1'),
        name: 'Aaron Jones',
        description: 'lowercase',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'WR2'),
        name: 'Tim Patrick',
        description: 'number suffix',
      },
      {
        week: 1,
        index: getPlayerIndex(1, 'RB2'),
        name: 'Alvin Kamara',
        description: 'number suffix',
      },
    ];

    enterPlayers(entryPlayers);
    saveEntry(1, testTime);
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
    const testTime = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    // Test that the same player cannot be selected multiple times in the same week
    const entryPlayers = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Josh Allen' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
    ];

    const validPlayers = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' },
    ];

    enterPlayers(entryPlayers);
    verifyFailedEntrySingleWeek('Josh Allen', '1', 'QB1', 'QB2');
    saveEntry(1, testTime);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);

    // Test that the same player cannot be selected multiple times across different weeks
    const entryPlayersTwo = [
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Gerald Everett' },
      { week: 10, index: getPlayerIndex(10, 'FLEX2'), name: 'Gerald Everett' },
    ];

    const validPlayersTwo = [
      { week: 3, index: getPlayerIndex(3, 'TE'), name: '' },
      { week: 10, index: getPlayerIndex(10, 'FLEX2'), name: 'Gerald Everett' },
    ];

    enterPlayers(entryPlayersTwo);
    saveEntry(10, testTime);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayersTwo);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in different week
    const entryPlayersThree = [
      { week: 5, index: getPlayerIndex(5, 'WR1'), name: 'Josh Reynolds' },
    ];

    enterPlayers(entryPlayersThree);
    saveEntry(5, testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    const duplicatePlayersThree = [
      { week: 7, index: getPlayerIndex(7, 'FLEX1'), name: 'Josh Reynolds' },
    ];

    enterPlayers(duplicatePlayersThree);
    verifyFailedEntrySavedWeek('Josh Reynolds');
    saveEntry(7, testTime);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in this week
    const entryPlayersFour = [
      { week: 5, index: getPlayerIndex(5, 'FLEX1'), name: 'Josh Reynolds' },
    ];

    enterPlayers(entryPlayersFour);
    verifyFailedEntrySavedWeek('Josh Reynolds');
    saveEntry(5, testTime);
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
    const testTime = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    // Test that the same player cannot be selected multiple times in the same week
    const entryPlayers = [
      {
        week: 4,
        index: getPlayerIndex(4, 'FLEX2'),
        name: 'Alexander Mattison',
      },
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: 'Alexander Mattison' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: 'Jake Bates' },
    ];

    const validPlayers = [
      { week: 4, index: getPlayerIndex(4, 'FLEX2'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'RB1'), name: '' },
      { week: 4, index: getPlayerIndex(4, 'K'), name: '' },
    ];

    enterPlayers(entryPlayers);
    verifyFailedEntrySingleWeek('Alexander Mattison', '4', 'FLEX2', 'RB1');
    saveAllEntries(testTime);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);

    // Test that the same player cannot be selected multiple times across different weeks
    const entryPlayersTwo = [
      { week: 16, index: getPlayerIndex(16, 'QB1'), name: 'Bo Nix' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: 'Bo Nix' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Bo Nix' },
    ];

    const validPlayersTwo = [
      { week: 16, index: getPlayerIndex(16, 'QB1'), name: '' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
    ];

    enterPlayers(entryPlayersTwo);
    saveAllEntries(testTime);
    verifyFailedEntryMultiWeek('Bo Nix', [1, 16, 17]);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayersTwo);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in different week
    const entryPlayersThree = [
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'LAR' },
    ];

    enterPlayers(entryPlayersThree);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    const duplicatePlayersThree = [
      { week: 17, index: getPlayerIndex(17, 'DEF'), name: 'LAR' },
    ];

    enterPlayers(duplicatePlayersThree);
    verifyFailedEntrySavedWeek('LAR');
    saveAllEntries(testTime);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(entryPlayersThree);

    // Test that the same player cannot be selected multiple times in the week and the player is already saved in this week
    const entryPlayersFour = [
      { week: 6, index: getPlayerIndex(6, 'FLEX1'), name: 'Josh Jacobs' },
    ];

    enterPlayers(entryPlayersFour);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(entryPlayersFour);

    const duplicatePlayersFour = [
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Josh Jacobs' },
    ];

    enterPlayers(duplicatePlayersFour);
    verifyFailedEntrySavedWeek('Josh Jacobs');
    saveAllEntries(testTime);
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
    const testTime = new Date('2024-09-06T00:19:00Z');
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
    ];

    const entryPlayersRBs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Jeff Wilson' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'Jerome Ford' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Jermar Jefferson' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'Gus Edwards' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Ameer Abdullah' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'Isaiah Pacheco' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Kareem Hunt' },
    ];

    const entryPlayersWRs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Deebo Samuel' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'DeVonta Smith' },
      { week: 6, index: getPlayerIndex(6, 'TE'), name: 'Devaughn Vele' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Nico Collins' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Stefon Diggs' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'David Bell' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Jahan Dotson' },
    ];

    const entryPlayersTEs = [
      { week: 6, index: getPlayerIndex(6, 'QB1'), name: 'Taysom Hill' },
      { week: 6, index: getPlayerIndex(6, 'QB2'), name: 'Adam Trautman' },
      { week: 6, index: getPlayerIndex(6, 'WR1'), name: 'George Kittle' },
      { week: 6, index: getPlayerIndex(6, 'WR2'), name: 'Luke Musgrave' },
      { week: 6, index: getPlayerIndex(6, 'K'), name: 'Tyler Kraft' },
      { week: 6, index: getPlayerIndex(6, 'DEF'), name: 'Tyler Conklin' },
      { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Cole Kmet' },
      { week: 6, index: getPlayerIndex(6, 'RB2'), name: 'Brevin Jordan' },
    ];

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
    ];

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
    ];

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
    ];

    enterPlayers(entryPlayersQBs);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersRBs);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersWRs);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersTEs);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersKs);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);

    enterPlayers(entryPlayersDefenses);
    saveEntry(6, testTime);
    verifyNoPlayersSaved();
    saveAllEntries(testTime);
    verifyNoPlayersSaved();
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(validPlayers);
    cy.wait(200);
  });

  // /*
  // TEST: No Shared Entries Between Users

  // Purpose:
  // - Test that data handling works correctly with user changes
  // */
  // it('Entries not visible to other users', () => {
  //   const testTime = new Date('2024-09-06T00:19:00Z');
  //   clearEntriesUserOne();
  //   clearEntriesUserTwo();

  //   loginAsUserOne();
  //   openWeekCards();

  //   // Test saving multiple players for user 1
  //   const playersUserOne = [
  //     { week: 9, index: getPlayerIndex(9, 'RB1'), name: 'Jerome Ford' },
  //     { week: 9, index: getPlayerIndex(9, 'RB2'), name: 'Raheem Mostert' },
  //     { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Josh Allen' },
  //     { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
  //     { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Justin Jefferson' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Dyami Brown' },
  //     { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Travis Kelce' },
  //     { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Christian McCaffrey' },
  //     { week: 4, index: getPlayerIndex(4, 'K'), name: 'Justin Tucker' }
  //   ];

  //   const playersUserOneBlank = [
  //     { week: 9, index: getPlayerIndex(9, 'RB1'), name: '' },
  //     { week: 9, index: getPlayerIndex(9, 'RB2'), name: '' },
  //     { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
  //     { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' },
  //     { week: 2, index: getPlayerIndex(2, 'WR1'), name: '' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: '' },
  //     { week: 2, index: getPlayerIndex(2, 'TE'), name: '' },
  //     { week: 3, index: getPlayerIndex(3, 'RB1'), name: '' },
  //     { week: 4, index: getPlayerIndex(4, 'K'), name: '' }
  //   ]

  //   enterPlayers(playersUserOne);
  //   saveAllEntries(testTime);
  //   verifySuccessfulEntry();
  //   openWeekCards();
  //   verifyPlayerEntries(playersUserOne);

  //   loginAsUserTwo();
  //   openWeekCards();

  //   verifyPlayerEntries(playersUserOneBlank);

  //   // Test saving the same players in different spots for user 2
  //   const playersUserTwo = [
  //     { week: 4, index: getPlayerIndex(4, 'RB1'), name: 'Jerome Ford' },
  //     { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'Raheem Mostert' },
  //     { week: 5, index: getPlayerIndex(5, 'QB1'), name: 'Josh Allen' },
  //     { week: 6, index: getPlayerIndex(6, 'RB1'), name: 'Saquon Barkley' },
  //     { week: 7, index: getPlayerIndex(7, 'WR1'), name: 'Justin Jefferson' },
  //     { week: 7, index: getPlayerIndex(7, 'FLEX2'), name: 'Dyami Brown' },
  //     { week: 7, index: getPlayerIndex(7, 'TE'), name: 'Travis Kelce' },
  //     { week: 14, index: getPlayerIndex(14, 'RB1'), name: 'Christian McCaffrey' },
  //     { week: 17, index: getPlayerIndex(17, 'K'), name: 'Justin Tucker' }
  //   ]

  //   const playersUserTwoBlank = [
  //     { week: 4, index: getPlayerIndex(4, 'RB1'), name: '' },
  //     { week: 3, index: getPlayerIndex(3, 'RB2'), name: '' },
  //     { week: 5, index: getPlayerIndex(5, 'QB1'), name: '' },
  //     { week: 6, index: getPlayerIndex(6, 'RB1'), name: '' },
  //     { week: 7, index: getPlayerIndex(7, 'WR1'), name: '' },
  //     { week: 7, index: getPlayerIndex(7, 'FLEX2'), name: '' },
  //     { week: 7, index: getPlayerIndex(7, 'TE'), name: '' },
  //     { week: 14, index: getPlayerIndex(14, 'RB1'), name: '' },
  //     { week: 17, index: getPlayerIndex(17, 'K'), name: '' }
  //   ]

  //   enterPlayers(playersUserTwo);
  //   saveAllEntries(testTime);
  //   verifySuccessfulEntry();
  //   openWeekCards();
  //   verifyPlayerEntries(playersUserTwo);

  //   loginAsUserOne();
  //   openWeekCards();

  //   verifyPlayerEntries(playersUserTwoBlank);
  //   verifyPlayerEntries(playersUserOne);

  //   loginAsUserTwo();
  //   openWeekCards();

  //   verifyPlayerEntries(playersUserOneBlank);
  //   verifyPlayerEntries(playersUserTwo);
  // });

  /*
  TEST: Bye Week Handling

  Purpose:
  - Test that a player cannot be selected in a week that they are on bye
  */
  it('Bye Week Handling', () => {
    const testTime = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    const playerEntries = [
      { week: 5, index: getPlayerIndex(5, 'RB1'), name: 'Saquon Barkley' },
      { week: 5, index: getPlayerIndex(5, 'FLEX2'), name: 'Amon-Ra St. Brown' },
      { week: 8, index: getPlayerIndex(8, 'WR1'), name: 'Justin Jefferson' },
      { week: 10, index: getPlayerIndex(10, 'WR2'), name: 'George Pickens' },
    ];

    const playerEntriesActual = [
      { week: 5, index: getPlayerIndex(5, 'RB1'), name: '' },
      { week: 5, index: getPlayerIndex(5, 'FLEX2'), name: '' },
      { week: 8, index: getPlayerIndex(8, 'WR1'), name: '' },
      { week: 10, index: getPlayerIndex(10, 'WR2'), name: '' },
    ];

    enterPlayers(playerEntries);
    saveAllEntries(testTime);
    verifyPlayerOnBye('Saquon Barkley', 5);
    cy.reload();
    cy.url().should('include', '/games/dfs-survivor/entries');
    openWeekCards();
    verifyPlayerEntries(playerEntriesActual);
  });

  /* 
  TEST: Timing Restrictions

  Purpose:
  - Test that players cannot be selected after the game has started
  */
  it('Timing Restrictions', () => {
    const testTimeOne = new Date('2024-09-06T00:21:00Z');
    clearEntriesUserOne();

    // Try Save Entry on a player thats game has started
    const playerEntriesOne = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Lamar Jackson' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
    ];

    const playerEntriesOneVerification = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: '' },
    ];

    enterPlayers(playerEntriesOne);
    saveEntry(1, testTimeOne);
    cy.reload();
    openWeekCards();
    verifyPlayerEntries(playerEntriesOneVerification);

    // Try Save All Entries on a player thats game has started
    const testTimeTwo = new Date('2024-09-09T00:22:00Z');

    const playerEntriesTwo = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Jared Goff' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Lamar Jackson' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Najee Harris' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'MIA' },
    ];

    const playerEntriesTwoVerification = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: '' },
    ];

    enterPlayers(playerEntriesTwo);
    saveAllEntries(testTimeTwo);
    cy.reload();
    openWeekCards();
    verifyPlayerEntries(playerEntriesTwoVerification);

    // Try to delete the bad player and then save entry
    const playerEntriesThreeVerification = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: '' },
    ];

    enterPlayers(playerEntriesOne);
    saveEntry(1, testTimeOne);

    // Clear problematic entries
    const entriesToClearThree = [
      { index: getPlayerIndex(1, 'QB1') },
      { index: getPlayerIndex(1, 'QB2') },
      { index: getPlayerIndex(1, 'DEF') },
    ];
    entriesToClearThree.forEach(({ index }) => {
      cy.get('input[type="text"].w-full').eq(index).clear();
      cy.wait(100);
    });

    saveEntry(1, testTimeOne);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesThreeVerification);

    // Try to delete the bad player and then save all entries
    const playerEntriesFourVerification = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: '' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Lamar Jackson' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Najee Harris' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'MIA' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
    ];

    enterPlayers(playerEntriesTwo);
    saveAllEntries(testTimeTwo);

    cy.get('input[type="text"].w-full').eq(getPlayerIndex(1, 'QB1')).clear();
    cy.wait(100);

    saveAllEntries(testTimeTwo);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesFourVerification);

    // Advance to after season
    const testTimeFive = new Date('2025-01-10T00:23:00Z');
    // Ensure I cannot save entry for anything

    const playerEntriesFive = [
      { week: 17, index: getPlayerIndex(17, 'QB1'), name: 'Jared Goff' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: 'Jalen Hurts' },
      { week: 17, index: getPlayerIndex(17, 'RB1'), name: 'Aaron Jones' },
      { week: 5, index: getPlayerIndex(5, 'DEF'), name: 'NYJ' },
    ];

    const playerEntriesFiveVerification = [
      { week: 17, index: getPlayerIndex(17, 'QB1'), name: '' },
      { week: 17, index: getPlayerIndex(17, 'QB2'), name: '' },
      { week: 17, index: getPlayerIndex(17, 'RB1'), name: '' },
      { week: 5, index: getPlayerIndex(5, 'DEF'), name: '' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Saquon Barkley' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Lamar Jackson' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Najee Harris' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'MIA' },
    ];

    enterPlayers(playerEntriesFive);
    saveAllEntries(testTimeFive);
    cy.reload();
    openWeekCards();
    verifyPlayerEntries(playerEntriesFiveVerification);
  });

  /* locking Restrictions

  Purpose:
  - Test that player selections are locked after the game has started
  - Test that weeks become locked after the last game of the week has started
  - Test that save entry button is disabled after the last game of the week has started
  - Test that save all entries button is disabled after the last game of the year has started
  */

  it('Locking Restrictions', () => {
    const testTimePreseason = new Date('2024-09-06T00:19:00Z');
    clearEntriesUserOne();

    // Select Xaiver Worthy Week 1
    const playerEntriesOne = [
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Xavier Worthy' },
    ];

    enterPlayers(playerEntriesOne);
    saveEntry(1, testTimePreseason);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesOne);

    // Fast forward to the start of the game
    navigateWithMockTime(new Date('2024-09-06T00:21:00Z'));
    openWeekCards();
    // Make sure that that box is disabled
    cy.get('input[type="text"].w-full')
      .eq(getPlayerIndex(1, 'WR2'))
      .should('be.disabled');

    // Make sure the svae entry button is not disabled
    cy.get('button:contains("Save Entry")').eq(0).should('not.be.disabled');

    // Fast forward to week 5 before MNF
    navigateWithMockTime(new Date('2024-10-08T00:00:00Z'));
    openWeekCards();
    for (let week = 1; week <= 4; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('input[type="text"].w-full').should('be.disabled');
        cy.get('button:contains("Save Entry")').should('be.disabled');
      });
    }
    for (let week = 5; week <= 17; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('button:contains("Save Entry")').should('not.be.disabled');
      });
    }
    cy.get('button:contains("Save All Entries")').should('not.be.disabled');

    // Fast forward to end of season
    navigateWithMockTime(new Date('2025-02-31T00:00:00Z'));
    openWeekCards();

    // Make sure all entry boxes are disabled
    cy.get('input[type="text"].w-full').should('be.disabled');

    // Make sure all save entry buttons are disabled
    cy.get('button:contains("Save Entry")').should('be.disabled');

    // Make sure save all entries button is disabled
    cy.get('button:contains("Save All Entries")').should('be.disabled');

    // For week 7 set the time to 1 second before the game starts and see if the save entry button is disabled
    navigateWithMockTime(new Date('2024-10-22T00:59:00Z'));
    openWeekCards();
    for (let week = 1; week <= 6; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('input[type="text"].w-full').should('be.disabled');
        cy.get('button:contains("Save Entry")').should('be.disabled');
      });
    }
    for (let week = 7; week <= 17; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('button:contains("Save Entry")').should('not.be.disabled');
      });
    }

    // For week 7 set the time to 1 second after the game starts and see if the save entry button is enabled
    navigateWithMockTime(new Date('2024-10-22T01:00:00Z'));
    openWeekCards();
    for (let week = 1; week <= 7; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('input[type="text"].w-full').should('be.disabled');
        cy.get('button:contains("Save Entry")').should('be.disabled');
      });
    }
    for (let week = 8; week <= 17; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).within(() => {
        cy.get('button:contains("Save Entry")').should('not.be.disabled');
      });
    }
  });

  // /*
  // TEST: Scoring Validation

  // Purpose:
  // - Test that entries are scored correctly and scores are displayed properly
  // */
  // it('Scoring Validation', () => {
  //   const testTime = new Date('2024-09-06T00:19:00Z');
  //   unscoreAllWeeks();
  //   clearEntriesUserOne();

  //   // Create full entries for user one weeks 1 and 2 and 3
  //   const playerEntriesOne = [
  //     { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
  //     { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
  //     { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
  //     { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
  //     { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
  //     { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
  //     { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
  //     { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
  //     { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
  //     { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Jared Goff' },
  //     { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
  //     { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
  //     { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
  //     { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
  //     { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
  //     { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
  //     { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
  //     { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
  //     { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
  //     { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
  //     { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
  //     { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
  //     { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
  //     { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
  //     { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Ray Davis' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
  //     { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
  //     { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
  //   ]
  //   enterPlayers(playerEntriesOne);
  //   saveAllEntries(testTime);
  //   verifySuccessfulEntry();
  //   openWeekCards();
  //   verifyPlayerEntries(playerEntriesOne);

  //   // Create full entries for user two weeks 1 and 2 and 3
  //   clearEntriesUserTwo();
  //   const playerEntriesTwo = [
  //     { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
  //     { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
  //     { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
  //     { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
  //     { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
  //     { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
  //     { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
  //     { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
  //     { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
  //     { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Sam Darnold' },
  //     { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
  //     { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
  //     { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
  //     { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
  //     { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
  //     { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
  //     { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
  //     { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
  //     { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
  //     { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
  //     { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
  //     { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
  //     { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
  //     { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
  //     { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Ray Davis' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
  //     { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
  //     { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
  //   ]
  //   enterPlayers(playerEntriesTwo);
  //   saveAllEntries(testTime);
  //   verifySuccessfulEntry();
  //   openWeekCards();
  //   verifyPlayerEntries(playerEntriesTwo);

  //   // Create full entries for admin weeks 1 and 2 and 3
  //   clearEntriesAdmin();
  //   const playerEntriesAdmin = [
  //     { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
  //     { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
  //     { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
  //     { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
  //     { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
  //     { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
  //     { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
  //     { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
  //     { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
  //     { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
  //     { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Sam Darnold' },
  //     { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
  //     { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
  //     { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
  //     { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
  //     { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
  //     { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
  //     { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
  //     { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
  //     { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
  //     { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
  //     { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
  //     { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
  //     { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
  //     { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
  //     { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
  //     { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Breece Hall' },
  //     { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
  //     { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
  //     { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
  //   ]
  //   enterPlayers(playerEntriesAdmin);
  //   saveAllEntries(testTime);
  //   verifySuccessfulEntry();
  //   openWeekCards();
  //   verifyPlayerEntries(playerEntriesAdmin);

  //   // Fast forward to week 3
  //   navigateWithMockTime(new Date('2024-09-25T00:59:00Z'));

  //   // Score weeks 1-3
  //   cy.navigateToDFSSurvivorAdmin();
  //   cy.wait(200);

  //   // Score specific weeks using a robust approach similar to revertScoredWeeks
  //   const scoreSpecificWeeks = (weeksToScore: number[]) => {
  //     const scoreNextWeek = (remainingWeeks: number[]) => {
  //       if (remainingWeeks.length === 0) return;

  //       const weekToScore = remainingWeeks[0];
  //       const restOfWeeks = remainingWeeks.slice(1);

  //       cy.get('table tbody tr').then($rows => {
  //         let foundWeek = false;

  //         // Check each row for the specific week number
  //         $rows.each((index, row) => {
  //           const firstCellText = Cypress.$(row).find('td').first().text().trim();

  //           if (firstCellText === weekToScore.toString()) {
  //             const $button = Cypress.$(row).find('button');
  //             if ($button.length > 0 && $button.text().trim() === 'Score Week') {
  //               foundWeek = true;
  //               // Click to score the week
  //               cy.wrap($button).click();
  //               cy.wait(1000); // Wait for the page to update
  //               return false; // Break out of the each loop
  //             }
  //           }
  //         });

  //         // Continue with the next week
  //         if (foundWeek) {
  //           // Wait for page update, then score the next week
  //           scoreNextWeek(restOfWeeks);
  //         } else {
  //           // Week was already scored or not found, continue with next
  //           scoreNextWeek(restOfWeeks);
  //         }
  //       });
  //     };

  //     scoreNextWeek(weeksToScore);
  //   };

  //   scoreSpecificWeeks([1, 2, 3]);

  //   // TODO: Verify correct scoring displays for users one two and admin

  //   cy.navigateToDFSSurvivor();
  //   openWeekCards();
  //   verifyPlayerEntries(playerEntriesAdmin);

    //   // Verify Correct Overall Standings

    //   // Verify correct weekly standings

    //   // Create some entries for user one week 4

    //   // Create full entries for user two week 4

    //   // Create no entries for admin in week 4

    //   // Fast forward to week 5

    //   // Score week 4

    //   // Verify correct scoring displays for users one two and admin

    //   // Verify Correct Overall Standings

    // Verify correct weekly standings
  });
});
