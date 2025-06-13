/// <reference types="cypress" />
export {}; // Convert file to module to avoid global scope pollution

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to mock login as a specific user
       * @example cy.loginAsUser({ discordId: '1111', discordName: 'UserOne' })
       */
      loginAsUser(user: { discordId: string; discordName: string }): Chainable<void>;

      /**
       * Custom command to navigate to DFS survivor page
       * @example cy.navigateToDFSSurvivor()
       */
      navigateToDFSSurvivor(): Chainable<void>;

      /**
       * Custom command to create a new DFS survivor contest
       * @example cy.createDFSSurvivorContest('Test Contest')
       */
      createDFSSurvivorContest(contestName: string): Chainable<void>;

      /**
       * Custom command to join a DFS survivor contest
       * @example cy.joinDFSSurvivorContest('contest-id')
       */
      joinDFSSurvivorContest(contestId: string): Chainable<void>;

      /**
       * Custom command to navigate to DFS survivor admin page
       * @example cy.navigateToDFSSurvivorAdmin()
       */
      navigateToDFSSurvivorAdmin(): Chainable<void>;
    }
  }
} 