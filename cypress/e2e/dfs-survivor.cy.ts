describe('DFS Survivor', () => {
  const clearAllEntries = () => {
    // Navigate to entries page
    cy.navigateToDFSSurvivor();

    // First open all weeks
    for (let week = 1; week <= 17; week++) {
      cy.get(`[data-testid="week-${week}-form"]`).click();
    }

    // Now find and clear only fields that have values
    cy.get('input[type="text"].w-full').each(($input) => {
      const value = $input.val();
      if (value && value.toString().trim() !== '') {
        cy.wrap($input).clear();
      }
    });

    // Click Save All Entries
    cy.get('button').contains('Save All Entries').click();

    // Wait for the page to reload
    cy.url().should('include', '/games/dfs-survivor/entries');
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

    // Clear any existing session cookies
    cy.clearCookie('_session');
    
    // Login before each test
    cy.loginAsUser(Cypress.env('userOne'));
    
    // Verify we're logged in
    cy.getCookie('_session').should('exist');

    // Clear all entries before each test
    clearAllEntries();
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
    cy.get('input[type="text"].w-full').eq(10).clear().type('Chicago Bears');
    cy.get('input[type="text"].w-full').eq(9).clear().type('Harrison Butker');
    cy.get('input[type="text"].w-full').eq(8).clear().type('Justin Watson');
    cy.get('input[type="text"].w-full').eq(7).clear().type('Amon-Ra St. Brown');
    cy.get('input[type="text"].w-full').eq(6).clear().type('Cole Kmet');
    cy.get('input[type="text"].w-full').eq(5).clear().type('Jameson Williams');
    cy.get('input[type="text"].w-full').eq(4).clear().type('Tim Patrick');
    cy.get('input[type="text"].w-full').eq(3).clear().type('Jahmyr Gibbs');
    cy.get('input[type="text"].w-full').eq(2).clear().type('David Montgomery');
    cy.get('input[type="text"].w-full').eq(1).clear().type('Jared Goff');
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');

    // Click the Save All Entries button
    cy.get('button').contains('Save Entry').click();

    // Wait for the page to reload and verify the selections
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.contains("Week 1").click();
    cy.get('input[type="text"].w-full').eq(0).should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(10).should('have.value', 'Chicago Bears');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'David Montgomery');
    cy.get('input[type="text"].w-full').eq(1).should('have.value', 'Jared Goff');
    cy.get('input[type="text"].w-full').eq(3).should('have.value', 'Jahmyr Gibbs');
    cy.get('input[type="text"].w-full').eq(5).should('have.value', 'Jameson Williams');
    cy.get('input[type="text"].w-full').eq(4).should('have.value', 'Tim Patrick');
    cy.get('input[type="text"].w-full').eq(6).should('have.value', 'Cole Kmet');
    cy.get('input[type="text"].w-full').eq(7).should('have.value', 'Amon-Ra St. Brown');
    cy.get('input[type="text"].w-full').eq(9).should('have.value', 'Harrison Butker');
    cy.get('input[type="text"].w-full').eq(8).should('have.value', 'Justin Watson');
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
    cy.get('input[type="text"].w-full').eq(7).clear().type('Dyami Brown');
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
    
    cy.get('input[type="text"].w-full').first().should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'Saquon Barkley');

    cy.get('input[type="text"].w-full').eq(8).should('have.value', 'Justin Jefferson');
    cy.get('input[type="text"].w-full').eq(7).should('have.value', 'Dyami Brown');

    cy.get('input[type="text"].w-full').eq(15).should('have.value', 'Christian McCaffrey');

    cy.get('input[type="text"].w-full').eq(20).should('have.value', 'Justin Tucker');
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
  - Week 1 entries should be saved and visible after reload
  - Week 2 entries should be cleared/not visible after reload
  */
  it('should only save entries for the week where Save Entry was clicked', () => {
    cy.navigateToDFSSurvivor();

    // Fill out Week 1 entries
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');
    cy.get('input[type="text"].w-full').eq(2).clear().type('Saquon Barkley');
    cy.get('input[type="text"].w-full').eq(6).clear().type('Travis Kelce');

    // Fill out Week 2 entries
    cy.get('[data-testid="week-2-form"]').click();
    cy.get('input[type="text"].w-full').eq(11).clear().type('Justin Jefferson');
    cy.get('input[type="text"].w-full').eq(13).clear().type('Christian McCaffrey');
    cy.get('input[type="text"].w-full').eq(17).clear().type('Gerald Everett');

    // Save only Week 1 by clicking its Save Entry button
    cy.get('button').contains('Save Entry').click();

    // Wait for page reload
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Verify Week 1 entries are saved
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').eq(0).should('have.value', 'Josh Allen');
    cy.get('input[type="text"].w-full').eq(2).should('have.value', 'Saquon Barkley');
    cy.get('input[type="text"].w-full').eq(6).should('have.value', 'Travis Kelce');

    // Verify Week 2 entries are not saved
    cy.get('[data-testid="week-2-form"]').click();
    cy.get('input[type="text"].w-full').eq(11).should('have.value', '');
    cy.get('input[type="text"].w-full').eq(13).should('have.value', '');
    cy.get('input[type="text"].w-full').eq(17).should('have.value', '');
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
  - User attempts to save the entry
  - User verifies the entry is not saved

  Expected Results:
  - Invalid player name should not be saved
  - Form should not submit successfully
  */
  it('should not save invalid player names', () => {
    cy.navigateToDFSSurvivor();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();

    // Try to enter invalid player name
    cy.get('input[type="text"].w-full').first().clear().type('Invalid Player XYZ');

    // Try to save
    cy.get('button').contains('Save Entry').click();

    // Verify page reloaded
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Verify entry was not saved
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').first().should('have.value', '');
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
    cy.navigateToDFSSurvivor();

    // Open Week 1
    cy.get('[data-testid="week-1-form"]').click();

    // Select Josh Allen as QB1
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');

    // Try to select Josh Allen as QB2
    cy.get('input[type="text"].w-full').eq(1).clear().type('Josh Allen');

    // Try to save
    cy.get('button').contains('Save All Entries').click();

    // Verify error message appears
    cy.contains('Cannot save entries: A player has been selected multiple times').should('be.visible');

    // Verify entries were not saved
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').eq(0).should('have.value', '');
    cy.get('input[type="text"].w-full').eq(1).should('have.value', '');
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
    cy.navigateToDFSSurvivor();

    // Select and save Josh Allen in Week 1
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').eq(0).clear().type('Josh Allen');
    cy.get('button').contains('Save Entry').click();

    // Wait for page reload
    cy.url().should('include', '/games/dfs-survivor/entries');

    // Try to select Josh Allen in Week 2
    cy.get('[data-testid="week-2-form"]').click();
    cy.get('input[type="text"].w-full').eq(11).clear().type('Josh Allen');
    cy.get('button').contains('Save Entry').click();

    // Verify Week 2 entry was not saved
    cy.url().should('include', '/games/dfs-survivor/entries');
    cy.get('[data-testid="week-2-form"]').click();
    cy.get('input[type="text"].w-full').eq(11).should('have.value', '');

    // Verify Week 1 entry remains
    cy.get('[data-testid="week-1-form"]').click();
    cy.get('input[type="text"].w-full').eq(0).should('have.value', 'Josh Allen');
  });
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

//UI Interaction Tests:

/*
TEST: Week Card Expansion Behavior

Purpose:
- Test that week cards expand/collapse correctly and maintain proper state

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season

Test Steps:
- User opens Week 1 card
- User verifies Week 1 expands
- User opens Week 2 card
- User verifies Week 1 collapses automatically
- User verifies Week 2 expands
- User verifies form state is preserved during transitions

Expected Results:
- Only one week card should be expanded at a time
- Form state should be preserved when switching between weeks
- Transitions should be smooth and maintain scroll position
*/

/*
TEST: Save Button State Management

Purpose:
- Test that save buttons reflect proper state based on form validity

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season

Test Steps:
- User opens Week 1 with empty entries
- User verifies initial save button state
- User fills some valid entries
- User verifies save button becomes enabled
- User fills invalid entries
- User verifies save button state changes appropriately

Expected Results:
- Save button should be disabled when form is empty
- Save button should be enabled with valid entries
- Save button should be disabled with invalid entries
- Button state should update immediately with form changes
*/

//Data Persistence Tests:

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
- User verifies unsaved changes are handled appropriately

Expected Results:
- Saved entries should persist after refresh
- Unsaved changes should be handled according to spec
- Form state should be correctly restored
*/

/*
TEST: Session Management

Purpose:
- Test that data handling works correctly with session changes

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season

Test Steps:
- User fills and saves entries
- User logs out
- User logs back in
- User verifies all saved entries are present
- User verifies form state is correctly restored

Expected Results:
- All saved data should persist across sessions
- Form state should be correctly restored after login
- User preferences should be maintained
*/

/*
TEST: Player Team Change Handling

Purpose:
- Test that entries handle players who change teams mid-season correctly

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Database includes player who changed teams

Test Steps:
- User selects player who changed teams in Week 1
- User saves entry
- User verifies entry in later week shows correct team
- User verifies historical entries maintain original team
- User verifies scoring remains accurate

Expected Results:
- Player entries should reflect correct team for each week
- Historical entries should maintain accuracy
- Scoring should account for team changes correctly
*/

/*
TEST: Bye Week Handling

Purpose:
- Test that system properly handles players during bye weeks

Prerequisites:
- DFS Survivor created for active season
- DFS Survivor open for active season
- Known bye week schedule in database

Test Steps:
- User attempts to select player during their bye week
- User verifies system prevents/warns about bye week selection
- User attempts to save entry with bye week player
- User verifies appropriate error handling
- User verifies other weeks aren't affected

Expected Results:
- System should prevent/warn about bye week selections
- Error messages should clearly indicate bye week conflict
- Other weeks' selections should remain unaffected
*/

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