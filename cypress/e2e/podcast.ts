describe('podcast tests', () => {
  it('Navigate to podcasts home page', () => {
    cy.visit('/');

    // podcasts page will be the third link in nav bar
    cy.get('nav').find('a').contains('Podcast').click();
    cy.url().should('include', '/podcast');
  });

  it('Check Title', () => {
    cy.visit('/podcast');
    cy.get('#Title').contains('Trash Turtle Football');
  });

  it('Check Hosts', () => {
    cy.visit('/podcast');
    cy.get('#Hosts').contains('DrTrashdad and Bootzfantasy');
  });

  it('Check Description', () => {
    cy.visit('/podcast');
    cy.get('#Decription').contains(
      'Unleashed from the iconic Flexspot Fantasy Football Discord server, Dr. Trashdad and Bootz bring the next generation of a fantasy football podcast.\
 A conversation between a numbers and spreadsheets analyst and a film room or gut drafter, Bootz and Trashdad talk about fantasy\
 relevant topics to help you get the edge you need in your league. Redraft, dynasty, bestball, and even some sportsbetting are common topics.\
 Listen to us to get in-depth and less talked-about fantasy knowledge without the fluff.',
    );
  });
});
