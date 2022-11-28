import { afterAll, assert, expect, test, describe } from 'vitest'
//import {render, screen} from "@testing-library/react"
import {render, screen} from "@remix-run/react";

import Records from './podcast';
// import { usersData } from '../mockData'


test('Check Title', () => {
  const { container } = render(<Records/>);
  // screen.getByText("Trash Turtle Football");
  expect(container).toContain("uqhwdiuqwhdiuqwdhwq");
});

test('Check Hosts', () => {
  const { container } = render(Records());
  expect(container).toContain("DrTrashdad and Bootzfantasy");
});

test('Check Description', () => {
  const { container } = render(Records);
  expect(container).toContain('Unleashed from the iconic Flexspot Fantasy Football Discord server, Dr. Trashdad and Bootz bring the next generation of a fantasy football podcast.\
  A conversation between a numbers and spreadsheets analyst and a film room or gut drafter, Bootz and Trashdad talk about fantasy\
  relevant topics to help you get the edge you need in your league. Redraft, dynasty, bestball, and even some sportsbetting are common topics.\
  Listen to us to get in-depth and less talked-about fantasy knowledge without the fluff.');
});

test('test', () => {
  render(<Records/>)
  expect(
    screen.getByRole('heading', {
      level:2})
).toHaveTextContext("Trash Turtle Football");
});


// test('with HTTP injection', async () => {
//   const response = await podcast.inject({
//     method: 'GET',
//     url: '/users',
//   })

//   expect(response.statusCode).toBe(200)
//   expect(JSON.parse(response.payload)).toHaveLength(4)
//   expect(JSON.parse(response.payload)).toStrictEqual(usersData)
// })

// test('with a running server', async () => {
//   await podcast.ready()

//   const response = await supertest(podcast.server)
//     .get('/users')
//     .expect(200)

//   expect(response.body).toHaveLength(4)
//   expect(response.body).toStrictEqual(usersData)
// })

// test('with axios', async () => {
//   await podcast.listen()
//   await podcast.ready()

//   const address = podcast.server.address()
//   const port = typeof address === 'string' ? address : address?.port

//   const response = await axios.get(`http://localhost:${port}/users`)

//   expect(response.data).toHaveLength(4)
//   expect(response.data).toStrictEqual(usersData)
// })

// afterAll(async () => {
//   await podcast.close()
// })

