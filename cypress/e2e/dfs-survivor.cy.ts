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

  const openWeekCards = (weeks: number[]) => {
    weeks.forEach(week => {
      cy.contains(`Week ${week}`).click();
      cy.wait(100);
    });
    cy.wait(50);
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

    // First, ensure all weeks are open in reverse order (17 to 1)
    for (let week = 17; week >= 1; week--) {
      // Click on the week header text to open the card
      cy.contains(`Week ${week}`).click();
      cy.wait(100); // Longer wait to ensure animation completes
      
      // Verify the card is open by checking for visible inputs
      cy.get(`[data-testid="week-${week}-form"]`)
        .find('input[type="text"].w-full')
        .should('be.visible');
    }

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
  TEST: Singular Player Selection

  Purpose:
  - Test the ability to select a single player for a week and save the entry

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - A user selects a singluar player for any week and any position
  - The user clicks the "Save Entry" button
  - The user opens up the tab for the week in which they made the selection

  Expected Results:
  - The user sees the player they selected in the lineup
  */
  it('should allow single player selection and save', () => {
    loginAsUserOne();
    clearEntriesUserOne();
    cy.navigateToDFSSurvivor();

    let testWeeks = [1];
    openWeekCards(testWeeks);

    const players = [
      { index: 0, name: 'Daniel Jones' }
    ];

    // Fill out each player with proper waits
    players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50);
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(50); // Wait for any potential auto-complete/validation
    });
    cy.wait(100);

    // Ensure form is ready before saving
    cy.get('button').contains('Save Entry').should('be.visible').should('be.enabled').click();
    cy.wait(50);

    // Verify it was saved
    cy.contains('Entries successfully submitted').should('be.visible');

    // Reload the page
    cy.reload();

    // Wait for save to complete and page to stabilize
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Verify entries after save
    cy.contains(`Week 1`).click();
    cy.wait(50);
    
    // Verify each player was saved
    players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    clearAllEntries();
  });

  /*
  TEST: Singluar Player Selection

  Purpose:
  - Test the ability to select player for multiple weeks and save the entry

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - A user selects a singluar player for any week and any position
  - The user then selects a second player for a different week and any position
  - The user clicks the "Save All Entries" button
  - The user opens up the tab for both weeks in which they made the selection

  Expected Results:
  - The user sees the players they selected in the lineup
  */
  it('should allow single player selections across different weeks', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    const playerSelections = [
      { week: 1, index: 2, name: 'Saquon Barkley' },
      { week: 3, index: 17, name: 'Gerald Everett' },
      { week: 10, index: 26, name: 'Jordan Addison' }
    ];

    // Wait for the form to be visible and open Week 1
    cy.contains(`Week 1`).click();
    cy.wait(50);
    cy.contains(`Week 3`).click();
    cy.wait(50);
    cy.contains(`Week 10`).click();
    cy.wait(50);

    // Fill out entries for each week
    playerSelections.forEach(({ index, name }) => {
      // Fill player name and wait for validation
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50);
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(50); // Wait after typing player name
    });
    cy.wait(100);

    // Ensure Save All Entries button is ready
    cy.get('button').contains('Save All Entries').should('be.visible').should('be.enabled').click();
    cy.wait(50);

    // Verify it was saved
    cy.contains('Entries successfully submitted').should('be.visible');

    // Reload the page
    cy.reload();

    // Wait for save to complete
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Wait for the form to be visible and open Week 1
    cy.contains(`Week 1`).click();
    cy.wait(50);
    cy.contains(`Week 3`).click();
    cy.wait(50);
    cy.contains(`Week 10`).click();
    cy.wait(50);

    // Verify all entries were saved
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
      cy.wait(50);
    });

    clearAllEntries();
  });

  /*
  TEST: Multiple Player Selection

  Purpose:
  - Test the ability to select multiple players for one week and save the entry

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - A user selects a singluar player for any week and any position
  - The user then selects a second player for the same week and any position
  - The user clicks the "Save Entry" button
  - The user opens up the tab for the week in which they made the selection

  Expected Results:
  - The user sees the players they selected in the lineup
  */
  it('should allow multiple player selections in the same week', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Wait for the form to be visible and open Week 1
    cy.contains("Week 1").click();
    cy.wait(50);

    // Select players one by one with waits
    const players = [
      { index: 10, name: 'CHI' },
      { index: 9, name: 'Harrison Butker' },
      { index: 8, name: 'Justin Watson' },
      { index: 7, name: 'Amon-Ra St. Brown' },
      { index: 6, name: 'Cole Kmet' },
      { index: 5, name: 'Jameson Williams' },
      { index: 4, name: 'Tim Patrick' },
      { index: 3, name: 'Jahmyr Gibbs' },
      { index: 2, name: 'David Montgomery' },
      { index: 1, name: 'Jared Goff' },
      { index: 0, name: 'Josh Allen' }
    ];

    // Fill out each player with proper waits
    players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
      cy.wait(50);
      cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
      cy.wait(50);
    });
    cy.wait(100);

    // Ensure form is ready before saving
    cy.get('button').contains('Save Entry').click();
    cy.wait(50);

    // Verify it was saved
    cy.contains('Entries successfully submitted').should('be.visible');

    // Reload the page
    cy.reload();

    // Wait for save to complete and page to stabilize
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Open Week 1
    cy.contains("Week 1").click();
    cy.wait(50);

    // Verify each player was saved
    players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    clearAllEntries();
  });

  /*
  TEST: Multiple Player Selection

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - A user selects a singluar player for any week and any position
  - The user then selects a second player for the same week and any position
  - The user then selects a third player for a different week and any position
  - The user then selects a fourth player for the same week and any position
  - The user then selects a fifth player for the same week and any position
  - The user then selects a sixth player for a different week and any position
  - The user then selects a seventh player for a different week and any position
  - The user clicks the "Save All Entries" button
  - The user opens up the tab for all four weeks in which they made the selection

  Expected Results:
  - The user sees the players they selected in the lineup
  */
  it('should allow complex multiple player selections across different weeks', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    const weekSelections = [
      {
        week: 1,
        players: [
          { index: 0, name: 'Josh Allen' },
          { index: 2, name: 'Saquon Barkley' }
        ]
      },
      {
        week: 2,
        players: [
          { index: 15, name: 'Justin Jefferson' },
          { index: 19, name: 'Dyami Brown' },
          { index: 17, name: 'Travis Kelce' }
        ]
      },
      {
        week: 3,
        players: [
          { index: 24, name: 'Christian McCaffrey' }
        ]
      },
      {
        week: 4,
        players: [
          { index: 42, name: 'Justin Tucker' }
        ]
      }
    ];

    // Open all required weeks first
    for (let week = 1; week < 5; week++) {
      // Click on the week header text to open the card
      cy.contains(`Week ${week}`).click();
      cy.wait(50); // Longer wait to ensure animation completes
    }

    // Fill out entries for each week
    weekSelections.forEach(({ players }) => {
      // Fill out each player in the week
      players.forEach(({ index, name }) => {
        cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
        cy.wait(50);
        cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
        cy.wait(50);
      });
    });
    cy.wait(200);

    // Ensure Save All Entries button is ready
    cy.get('button').contains('Save All Entries').should('be.visible').should('be.enabled').click();
    cy.wait(50);

    // Verify it was saved
    cy.contains('Entries successfully submitted').should('be.visible');

    // Reload the page
    cy.reload();

    // Wait for save to complete
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Open all required weeks first
    for (let week = 1; week < 5; week++) {
      // Click on the week header text to open the card
      cy.contains(`Week ${week}`).click();
      cy.wait(50); // Longer wait to ensure animation completes
    }

    // Verify all entries were saved
    weekSelections.forEach(({ players }) => {
      players.forEach(({ index, name }) => {
        cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
      });
    });

    clearAllEntries();
  });

  /*
  TEST: Independent Week Card Saving

  Purpose:
  - Test that saving one week's entries does not affect other weeks' unsaved entries

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - A user fills out multiple players in Week 1
  - The user fills out multiple players in Week 2
  - The user clicks "Save Entry" only for Week 1
  - The user verifies Week 1 entries are saved
  - The user verifies Week 2 entries are not saved

  Expected Results:
  - Week 1 entries should be saved and visible after saving
  - Week 2 entries should be cleared/not visible after saving
  */
  it('should only save entries for the week where Save Entry was clicked', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    const weekSelections = [
      {
        week: 1,
        players: [
          { index: 0, name: 'Josh Allen' },
          { index: 2, name: 'Saquon Barkley' },
          { index: 6, name: 'Travis Kelce' }
        ]
      },
      {
        week: 2,
        players: [
          { index: 16, name: 'Justin Jefferson' },
          { index: 13, name: 'Christian McCaffrey' },
          { index: 19, name: 'Dyami Brown' }
        ]
      }
    ];

    // Open all required weeks first
    for (let week = 1; week < 3; week++) {
      // Click on the week header text to open the card
      cy.contains(`Week ${week}`).click();
      cy.wait(50); // Longer wait to ensure animation completes
    }

    // Fill out entries for each week
    weekSelections.forEach(({ players }) => {
      // Fill out each player in the week
      players.forEach(({ index, name }) => {
        cy.get('input[type="text"].w-full').eq(index).should('be.visible').clear().type(name);
        cy.get('input[type="text"].w-full').eq(index).type('{downarrow}{enter}');
        cy.wait(50); // Wait for validation
      });
    });
    cy.wait(100);

    // Save only Week 1 by clicking its Save Entry button
    cy.get('button').contains('Save Entry').first().should('be.visible').click();
    cy.wait(50);

    // Verify it was saved
    cy.contains('Entries successfully submitted').should('be.visible');

    // Reload the page
    cy.reload();

    // Wait for save to complete
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Open all required weeks first
    for (let week = 1; week < 3; week++) {
      // Click on the week header text to open the card
      cy.contains(`Week ${week}`).click();
      cy.wait(50); // Longer wait to ensure animation completes
      
    }

    weekSelections[0].players.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', name);
    });

    weekSelections[1].players.forEach(({ index }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', '');
    });

    clearAllEntries();
  });

  /*
  TEST: Invalid Player Name Entry

  Purpose:
  - Test that invalid/non-existent player names cannot be saved

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User opens Week 1
  - User attempts to enter non-existent player name
  - User attempts to enter a player name without proper capitalization
  - User attempts to enter a player name with a space
  - User attempts to enter a player name with a number
  - User attempts to enter a player name with a special character
  - User attempts to enter a player name with a team abbreviation
  - User attempts to save the entry
  - User verifies the entry is not saved

  Expected Results:
  - Invalid player name should not be saved
  - Form should not submit successfully
  */
  it('should not save invalid player names', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form

    const invalidPlayerTests = [
      { index: 10, name: 'Detroit Lions', description: 'team name' },
      { index: 0, name: 'Invalid Player XYZ', description: 'non-existent player' },
      { index: 9, name: 'HaRrIson bUtKer', description: 'improper capitalization' },
      { index: 8, name: 'JOSH JACOBS', description: 'all caps' },
      { index: 7, name: 'aaron jones', description: 'lowercase' },
      { index: 6, name: 'Trey  McBride', description: 'double space' },
      { index: 5, name: 'Tim Patrick1', description: 'number suffix' },
      { index: 4, name: 'T14i342m Jon132es38129371884', description: 'numbers in name' },
      { index: 3, name: 'Alvin Kamara38129371884', description: 'number suffix' },
      { index: 2, name: 'Kyren William$', description: 'special character' }
    ];

    // Try each invalid player name
    invalidPlayerTests.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name);
      cy.wait(50); // Wait after typing player name
    });
    cy.wait(100);

    // Try to save
    cy.get('button').contains('Save Entry').click();
    cy.wait(50);

    // Reload the page
    cy.reload();

    // Verify page reloaded
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Verify entries - only properly formatted names should be saved
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form

    const expectedSavedValues: Record<number, string> = {
      3: 'Alvin Kamara',
      5: 'Tim Patrick',
      7: 'Aaron Jones',
      8: 'Josh Jacobs',
      9: 'Harrison Butker',
      10: 'DET'
    };

    // Verify each field
    invalidPlayerTests.forEach(({ index }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', expectedSavedValues[index] || '');
    });

    clearAllEntries();
  });

  /*
  TEST: Same Week Duplicate Prevention

  Purpose:
  - Test that the same player cannot be selected multiple times in the same week

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User opens Week 1
  - User selects a player in one position
  - User attempts to select the same player in another position
  - User attempts to save entries
  - User verifies error message and prevention of save

  Expected Results:
  - Duplicate selection should show error
  - Save operation should be blocked
  */
  it('should prevent duplicate player selections in same week', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50);

    const playerSelections = [
      { index: 2, name: 'Najee Harris' },
      { index: 1, name: 'Josh Allen' },
      { index: 0, name: 'Josh Allen' } // Duplicate entry
    ];

    // Enter all players
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name);
      cy.wait(100); // Wait after typing player name
    });

    cy.wait(100);

    // Click the Save All Entries button
    cy.get('button').contains('Save All Entries').click();
    cy.wait(50);

    // Reload the page
    cy.reload();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50);

    // Verify that Najee Harris is saved in RB1 and QB1 and QB2 is empty
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'Najee Harris');
    cy.get('input[type="text"].w-full').eq(1).should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(0).should('have.value', '');

    clearAllEntries();
  });

  /*
  TEST: Cross-Week Duplicate Prevention

  Purpose:
  - Test that players cannot be reused across different weeks

  Prerequisites:
  - DFS Survivor created for active season
  - DFS Survivor open for active season

  Test Steps:
  - User saves a player in Week 1
  - User attempts to use same player in Week 2
  - User verifies player cannot be selected
  - User verifies appropriate error handling

  Expected Results:
  - Previously used player should not be selectable in new week
  - Save operation should be blocked
  */
  it('should prevent using same player across different weeks', () => {
    loginAsUserOne();
    cy.navigateToDFSSurvivor();

    // Select and save Josh Allen in Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');
    cy.wait(50);

    cy.get('button:contains("Save Entry")').then($buttons => {
      cy.wrap($buttons[0]).click();
    });

    // Wait for page reload
    cy.url().should('include', '/games/dfs-survivor/entries');

    cy.get('input[type="text"].w-full').eq(0).should('have.value', 'Josh Allen');
    cy.wait(50);


    // Try to select Josh Allen in Week 2
    cy.get('[data-testid="week-2-form"]').click();
    cy.wait(50);
    cy.get('input[type="text"].w-full').eq(11).clear().type('Josh Allen');
    cy.wait(50);
    
    // Verify error message appears
    cy.contains('Cannot select Josh Allen for week 1 QB1 and week 2 QB1').should('be.visible');

    // Click Save Entry for week 2

    clearAllEntries();
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
    cy.navigateToDFSSurvivor();

    // Select Jerry Jeudy in Week 1 as WR1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form
    cy.get('input[type="text"].w-full').eq(4).clear().type('Jerry Jeudy');
    cy.wait(50); // Wait after typing player name

    // Select Jerry Jeudy in Week 4 as WR2
    cy.get('[data-testid="week-4-form"]').click();
    cy.wait(50); // Wait after clicking week form
    cy.get('input[type="text"].w-full').eq(16).clear().type('Jerry Jeudy');
    cy.wait(50); // Wait after typing player name

    // Select Jerry Jeudy in Week 6 as FLEX1
    cy.get('[data-testid="week-6-form"]').click();
    cy.wait(50); // Wait after clicking week form
    cy.get('input[type="text"].w-full').eq(29).clear().type('Jerry Jeudy');
    cy.wait(50); // Wait after typing player name

    // Verify error message appears
    cy.contains('Cannot select Jerry Jeudy for week 1 WR1 and week 4').should('be.visible');

    // Verify that the Save Entry buttons for all weeks are enabled (since only cross-week duplicates)
    cy.get('button:contains("Save Entry")').each(($button) => {
      cy.wrap($button).should('not.be.disabled');
    });

    // Verify that the Save All Entries button is disabled
    cy.get('button').contains('Save All Entries').should('be.disabled');

    clearAllEntries();
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
    cy.navigateToDFSSurvivor();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form

    const invalidPositionTests = [
      { index: 2, name: 'Josh Allen', description: 'QB in RB slot' },
      { index: 7, name: 'Justin Tucker', description: 'K in FLEX slot' }
    ];

    // Try each invalid position
    invalidPositionTests.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name);
      cy.wait(50); // Wait after typing player name
    });

    // Try to save
    cy.get('button').contains('Save Entry').click();
    cy.wait(50);

    // Refresh the page
    cy.reload();
    cy.wait(50);

    // Verify entries were not saved
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.get('[data-testid="week-1-form"]').click();
    cy.wait(50); // Wait after clicking week form

    // Verify each field
    invalidPositionTests.forEach(({ index }) => {
      cy.get('input[type="text"].w-full').eq(index).should('have.value', '');
    });

    clearAllEntries();
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