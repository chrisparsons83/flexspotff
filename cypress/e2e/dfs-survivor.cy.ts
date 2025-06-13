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
        discordName: 'TestAdmin',
        discordAvatar: 'default_avatar',
        discordRoles: ['214097556051984385'] 
      }
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
    loginAsUserOne();
    navigateWithMockTime(new Date('2024-08-06T00:19:00Z'));
    clearAllEntries();
  };

  const clearEntriesUserTwo = () => {
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

  const enterPlayers = (playerSelections: Array<{week: number, index: number, name: string}>) => {
    //Set time to an hour before week 1 of the 2024 NFL season
    playerSelections.forEach(({ index, name }) => {
      cy.get('input[type="text"].w-full').eq(index).clear().type(name || ' ');
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

  const setMockTime = (date: Date) => {
    const mockTime = Cypress.env('TIME_MOCK_SECRET') + ':' + date.toISOString();
    cy.get('form[id^="week-"]').each($form => {
      cy.wrap($form).invoke('append', 
        `<input type="hidden" name="__test_current_time__" value="${mockTime}" />`
      );
    });
    cy.wait(100);
  };

  const navigateWithMockTime = (date: Date) => {
    const mockTime = Cypress.env('TIME_MOCK_SECRET') + ':' + date.toISOString();
    cy.visit(`/games/dfs-survivor/entries?__test_current_time__=${encodeURIComponent(mockTime)}`, { failOnStatusCode: false });
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
          if ($button.length > 0 && $button.text().trim() === 'Revert Scoring') {
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
  TEST: Scoring Validation

  Purpose:
  - Test that entries are scored correctly and scores are displayed properly
  */
  it('Scoring Validation', () => {
    const testTime = new Date('2024-09-06T00:19:00Z');
    unscoreAllWeeks();
    clearEntriesUserOne();

    // Create full entries for user one weeks 1 and 2 and 3
    const playerEntriesOne = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
      { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
      { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
      { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Jared Goff' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
      { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
      { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
      { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
      { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
      { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
      { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
      { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
      { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Ray Davis' },
      { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
      { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
      { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
    ]
    enterPlayers(playerEntriesOne);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesOne);

    // Create full entries for user two weeks 1 and 2 and 3
    clearEntriesUserTwo();
    const playerEntriesTwo = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
      { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
      { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
      { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Sam Darnold' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
      { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
      { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
      { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
      { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
      { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
      { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
      { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
      { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Ray Davis' },
      { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
      { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
      { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
    ]
    enterPlayers(playerEntriesTwo);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesTwo);

    // Create full entries for admin weeks 1 and 2 and 3
    clearEntriesAdmin();
    const playerEntriesAdmin = [
      { week: 1, index: getPlayerIndex(1, 'QB1'), name: 'Patrick Mahomes' },
      { week: 1, index: getPlayerIndex(1, 'QB2'), name: 'Justin Herbert' },
      { week: 1, index: getPlayerIndex(1, 'RB1'), name: 'Najee Harris' },
      { week: 1, index: getPlayerIndex(1, 'RB2'), name: 'Gus Edwards' },
      { week: 1, index: getPlayerIndex(1, 'WR1'), name: 'JuJu Smith-Schuster' },
      { week: 1, index: getPlayerIndex(1, 'WR2'), name: 'Ladd McConkey' },
      { week: 1, index: getPlayerIndex(1, 'TE'), name: 'Noah Gray' },
      { week: 1, index: getPlayerIndex(1, 'FLEX1'), name: 'Isaiah Likely' },
      { week: 1, index: getPlayerIndex(1, 'FLEX2'), name: 'Derrick Henry' },
      { week: 1, index: getPlayerIndex(1, 'K'), name: 'Justin Tucker' },
      { week: 1, index: getPlayerIndex(1, 'DEF'), name: 'BAL' },
      { week: 2, index: getPlayerIndex(2, 'QB1'), name: 'Sam Darnold' },
      { week: 2, index: getPlayerIndex(2, 'QB2'), name: 'Jordan Love' },
      { week: 2, index: getPlayerIndex(2, 'RB1'), name: 'Josh Jacobs' },
      { week: 2, index: getPlayerIndex(2, 'RB2'), name: 'David Montgomery' },
      { week: 2, index: getPlayerIndex(2, 'WR1'), name: 'Tim Patrick' },
      { week: 2, index: getPlayerIndex(2, 'WR2'), name: 'Jayden Reed' },
      { week: 2, index: getPlayerIndex(2, 'TE'), name: 'Tucker Kraft' },
      { week: 2, index: getPlayerIndex(2, 'FLEX1'), name: 'Justin Jefferson' },
      { week: 2, index: getPlayerIndex(2, 'FLEX2'), name: 'Rome Odunze' },
      { week: 2, index: getPlayerIndex(2, 'K'), name: 'Jake Bates' },
      { week: 2, index: getPlayerIndex(2, 'DEF'), name: 'DET' },
      { week: 3, index: getPlayerIndex(3, 'QB1'), name: 'Tua Tagovailoa' },
      { week: 3, index: getPlayerIndex(3, 'QB2'), name: 'Josh Allen' },
      { week: 3, index: getPlayerIndex(3, 'RB1'), name: 'Raheem Mostert' },
      { week: 3, index: getPlayerIndex(3, 'RB2'), name: 'James Cook' },
      { week: 3, index: getPlayerIndex(3, 'WR1'), name: 'Khalil Shakir' },
      { week: 3, index: getPlayerIndex(3, 'WR2'), name: 'Jaylen Waddle' },
      { week: 3, index: getPlayerIndex(3, 'TE'), name: 'Jonnu Smith' },
      { week: 3, index: getPlayerIndex(3, 'FLEX1'), name: 'Breece Hall' },
      { week: 3, index: getPlayerIndex(3, 'FLEX2'), name: 'Tyreek Hill' },
      { week: 3, index: getPlayerIndex(3, 'K'), name: 'Tyler Bass' },
      { week: 3, index: getPlayerIndex(3, 'DEF'), name: 'BUF' },
    ]
    enterPlayers(playerEntriesAdmin);
    saveAllEntries(testTime);
    verifySuccessfulEntry();
    openWeekCards();
    verifyPlayerEntries(playerEntriesAdmin);

    // Fast forward to week 3
    navigateWithMockTime(new Date('2024-09-25T00:59:00Z'));

    // Score weeks 1-3
    cy.navigateToDFSSurvivorAdmin();
    cy.wait(200);
    
    // Score specific weeks using a robust approach similar to revertScoredWeeks
    const scoreSpecificWeeks = (weeksToScore: number[]) => {
      const scoreNextWeek = (remainingWeeks: number[]) => {
        if (remainingWeeks.length === 0) return;
        
        const weekToScore = remainingWeeks[0];
        const restOfWeeks = remainingWeeks.slice(1);
        
        cy.get('table tbody tr').then($rows => {
          let foundWeek = false;
          
          // Check each row for the specific week number
          $rows.each((index, row) => {
            const firstCellText = Cypress.$(row).find('td').first().text().trim();
            
            if (firstCellText === weekToScore.toString()) {
              const $button = Cypress.$(row).find('button');
              if ($button.length > 0 && $button.text().trim() === 'Score Week') {
                foundWeek = true;
                // Click to score the week
                cy.wrap($button).click();
                cy.wait(1000); // Wait for the page to update
                return false; // Break out of the each loop
              }
            }
          });
          
          // Continue with the next week
          if (foundWeek) {
            // Wait for page update, then score the next week
            scoreNextWeek(restOfWeeks);
          } else {
            // Week was already scored or not found, continue with next
            scoreNextWeek(restOfWeeks);
          }
        });
      };
      
      scoreNextWeek(weeksToScore);
    };
    
    scoreSpecificWeeks([1, 2, 3]);

    // Verify correct scoring displays for users one two and admin
    
    cy.navigateToDFSSurvivor();
    openWeekCards();
    verifyPlayerEntries(playerEntriesAdmin);

    // Verify Correct Overall Standings

    // Verify correct weekly standings

    // Create some entries for user one week 4

    // Create full entries for user two week 4

    // Create no entries for admin in week 4

    // Fast forward to week 5

    // Score week 4

    // Verify correct scoring displays for users one two and admin

    // Verify Correct Overall Standings

    // Verify correct weekly standings

  });
});