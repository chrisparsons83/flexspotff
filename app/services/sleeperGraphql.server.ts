import { GraphQLClient } from "graphql-request";

const endpoint = `https://sleeper.com/graphql`;

export const graphQLClient = new GraphQLClient(endpoint);
