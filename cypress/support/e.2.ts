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
  // Create a session that matches Remix Auth's structure
  const sessionData = {
    id: `user_${user.discordId}`,
    discordId: user.discordId,
    discordName: user.discordName,
    discordAvatar: '',
    discordRoles: [],
    strategy: 'discord',
    __json: {
      id: user.discordId,
      username: user.discordName,
      discriminator: '0000',
      avatar: null,
      bot: false,
      system: false,
      mfa_enabled: false,
      banner: null,
      accent_color: null,
      locale: 'en-US',
      verified: true,
      email: null,
      flags: 0,
      premium_type: 0,
      public_flags: 0
    }
  };

  // Set both the session and flash cookies as Remix Auth expects them
  cy.setCookie('__session', btoa(JSON.stringify(sessionData)));
  cy.setCookie('__session.sig', ''); // Clear any existing signature
  cy.setCookie('__flash', btoa('{}'));
});

// Add custom command to navigate to DFS survivor page
Cypress.Commands.add('navigateToDFSSurvivor', () => {
  cy.visit('/games/dfs-survivor/entries');
});

// Add custom command to create a new DFS survivor contest
Cypress.Commands.add('createDFSSurvivorContest', (contestName: string) => {
  cy.get('[data-testid="create-contest-button"]').click();
  cy.get('[data-testid="contest-name-input"]').type(contestName);
  cy.get('[data-testid="submit-contest-button"]').click();
});

// Add custom command to join a DFS survivor contest
Cypress.Commands.add('joinDFSSurvivorContest', (contestId: string) => {
  cy.visit(`/games/dfs-survivor/${contestId}`);
  cy.get('[data-testid="join-contest-button"]').click();
}); 