// Import commands.js using ES2015 syntax:
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Hide XHR requests from command log
const app = window.top as Window & typeof globalThis;
if (app) {
  app.console.log = () => {};
}

// Add custom commands for authentication
Cypress.Commands.add('loginAsUser', (user: { discordId: string; discordName: string }) => {
  // Use the test login endpoint to properly set up the session
  cy.request({
    method: 'POST',
    url: '/api/test/login',
    body: {
      discordId: user.discordId,
      discordName: user.discordName,
      discordAvatar: 'default_avatar',
      discordRoles: ['user']
    }
  }).then((response) => {
    expect(response.status).to.eq(200);
  });

  // Visit root to ensure session is set
  cy.visit('/', { failOnStatusCode: false });
  
  // Verify we are logged in by checking for redirect
  cy.url().should('not.include', '/auth/discord');
});

// Add custom command to navigate to DFS survivor page
Cypress.Commands.add('navigateToDFSSurvivor', () => {
  // First verify we're authenticated
  cy.url().should('not.include', '/auth/discord');
  cy.visit('/games/dfs-survivor/entries', { failOnStatusCode: false });
  // Wait for page load and verify we weren't redirected to login
  cy.url().should('include', '/games/dfs-survivor/entries');
});

// Add custom command to create a new DFS survivor contest
Cypress.Commands.add('createDFSSurvivorContest', (contestName: string) => {
  cy.get('[data-testid="create-contest-button"]').click();
  cy.get('[data-testid="contest-name-input"]').type(contestName);
  cy.get('[data-testid="submit-contest-button"]').click();
});

// Add custom command to join a DFS survivor contest
Cypress.Commands.add('joinDFSSurvivorContest', (contestId: string) => {
  cy.visit(`/games/dfs-survivor/${contestId}`, { failOnStatusCode: false });
  cy.get('[data-testid="join-contest-button"]').click();
}); 