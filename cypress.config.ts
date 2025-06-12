import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  env: {
    userOne: {
      discordId: '1111',
      discordName: 'UserOne'
    },
    userTwo: {
      discordId: '2222',
      discordName: 'UserTwo'
    },
    userThree: {
      discordId: '3333',
      discordName: 'UserThree'
    },
    db: {
      host: 'localhost',
      port: 5432,
      database: 'flexspotff',
      user: 'postgres',
      password: 'postgres'
    },
    TIME_MOCK_SECRET: 'FDG*4#H(*)@EDHN'
  }
}); 