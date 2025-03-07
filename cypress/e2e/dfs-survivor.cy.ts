describe('DFS Survivor', () => {
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

    // Clear any existing session cookies
    cy.clearCookie('_session');
    
    // Login before each test
    cy.loginAsUser(Cypress.env('userOne'));
    
    // Verify we're logged in
    cy.getCookie('_session').should('exist');
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
    // Navigate to entries page
    cy.navigateToDFSSurvivor();

    // Wait for the form to be visible and open Week 1
    cy.get('[data-testid="week-1-form"]').click();

    // Select the player
    cy.get('input[type="text"].w-full').first().clear().type('Daniel Jones');

    // Click the Save Entry button
    cy.get('button').contains('Save Entry').click();

    // Wait for the page to reload and verify the selection
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').first().should('have.value', 'Daniel Jones');
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
    // Navigate to entries page
    cy.navigateToDFSSurvivor();

    // Wait for the form to be visible and open Week 1
    cy.get('[data-testid="week-1-form"]').click();

    // Select RB1 for Week 1
    cy.get('input[type="text"].w-full').eq(2).clear().type('Saquon Barkley');

    // Wait for the form to be visible and open Week 3
    cy.get('[data-testid="week-3-form"]').click();

    // Select TE for Week 3
    cy.get('input[type="text"].w-full').eq(17).clear().type('Gerald Everett');

    // Wait for the form to be visible and open Week 10
    cy.get('[data-testid="week-10-form"]').click();

    // Select WR for Week 10
    cy.get('input[type="text"].w-full').eq(26).clear().type('Justin Jefferson');

    // Click the Save Entry button
    cy.get('button').contains('Save All Entries').click();

    // Wait for the page to reload and verify the selection
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'Saquon Barkley');
    cy.get('input[type="text"].w-full').eq(17).should('have.value', 'Gerald Everett');
    cy.get('input[type="text"].w-full').eq(26).should('have.value', 'Justin Jefferson');
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
    cy.navigateToDFSSurvivor();

    // Wait for the form to be visible and open Week 1
    cy.get('[data-testid="week-1-form"]').click();

    // Select first player for Week 1
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');
    cy.get('input[type="text"].w-full').eq(10).clear().type('Chicago Bears');
    cy.get('input[type="text"].w-full').eq(2).clear().type('David Montgomery');
    cy.get('input[type="text"].w-full').eq(1).clear().type('Jared Goff');
    cy.get('input[type="text"].w-full').eq(3).clear().type('Jahmyr Gibbs');
    cy.get('input[type="text"].w-full').eq(5).clear().type('Jameson Williams');
    cy.get('input[type="text"].w-full').eq(4).clear().type('Tim Patrick');
    cy.get('input[type="text"].w-full').eq(6).clear().type('Craig Reynolds');
    cy.get('input[type="text"].w-full').eq(7).clear().type('Amon-Ra St. Brown');
    cy.get('input[type="text"].w-full').eq(9).clear().type('Harrison Butker');
    cy.get('input[type="text"].w-full').eq(8).clear().type('Cole Kmet');

    // Click the Save All Entries button
    cy.get('button').contains('Save Entry').click();

    // Wait for the page to reload and verify the selections
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.contains("Week 1").click();
    cy.get('input[type="text"].w-full').first().should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(1).should('have.value', 'Jared Goff');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'David Montgomery');
    cy.get('input[type="text"].w-full').eq(3).should('have.value', 'Jahmyr Gibbs');
    cy.get('input[type="text"].w-full').eq(4).should('have.value', 'Tim Patrick');
    cy.get('input[type="text"].w-full').eq(5).should('have.value', 'Jameson Williams');
    cy.get('input[type="text"].w-full').eq(6).should('have.value', 'Craig Reynolds');
    cy.get('input[type="text"].w-full').eq(7).should('have.value', 'Amon-Ra St. Brown');
    cy.get('input[type="text"].w-full').eq(8).should('have.value', 'Cole Kmet');
    cy.get('input[type="text"].w-full').eq(9).should('have.value', 'Harrison Butker');
    cy.get('input[type="text"].w-full').eq(10).should('have.value', 'Chicago Bears');
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
    cy.navigateToDFSSurvivor();

    // Week 1 selections
    cy.contains('Week 1').click();
    cy.get('input[type="text"].w-full').first().clear().type('Josh Allen');
    cy.get('input[type="text"].w-full').eq(2).clear().type('Saquon Barkley');

    // Week 2 selections
    cy.contains('Week 2').click();
    cy.get('input[type="text"].w-full').eq(8).clear().type('Justin Jefferson');
    cy.get('input[type="text"].w-full').eq(9).clear().type('Ja\'Marr Chase');
    cy.get('input[type="text"].w-full').eq(10).clear().type('Travis Kelce');

    // Week 3 selection
    cy.contains('Week 3').click();
    cy.get('input[type="text"].w-full').eq(15).clear().type('Christian McCaffrey');

    // Week 4 selection
    cy.contains('Week 4').click();
    cy.get('input[type="text"].w-full').eq(20).clear().type('Justin Tucker');

    // Click the Save All Entries button
    cy.get('button').contains('Save All Entries').click();

    // Verify all selections
    cy.url().should('include', '/games/dfs-survivor/entries');
    
    cy.contains('Week 1').click();
    cy.get('input[type="text"].w-full').first().should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'Saquon Barkley');

    cy.contains('Week 2').click();
    cy.get('input[type="text"].w-full').eq(8).should('have.value', 'Justin Jefferson');
    cy.get('input[type="text"].w-full').eq(9).should('have.value', 'Ja\'Marr Chase');
    cy.get('input[type="text"].w-full').eq(10).should('have.value', 'Travis Kelce');

    cy.contains('Week 3').click();
    cy.get('input[type="text"].w-full').eq(15).should('have.value', 'Christian McCaffrey');

    cy.contains('Week 4').click();
    cy.get('input[type="text"].w-full').eq(20).should('have.value', 'Justin Tucker');
  });
}); 