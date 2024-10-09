# base node image
FROM node:22-bullseye-slim AS base

ARG PROD_DATABASE_URL

# set for base and all layer that inherit from it
ENV NODE_ENV=production
ENV DATABASE_URL=$PROD_DATABASE_URL

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl

# Install all node_modules, including dev dependencies
FROM base AS deps

WORKDIR /myapp

ADD package.json package-lock.json ./
RUN npm install --production=false

# Setup production node_modules
FROM base AS production-deps

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules
ADD package.json package-lock.json ./
RUN npm prune --production

# Build the app
FROM base AS build

WORKDIR /myapp

COPY --from=deps /myapp/node_modules /myapp/node_modules

ADD prisma .
RUN npx prisma generate

ADD . .
RUN npm run build

# Finally, build the production image with minimal footprint
FROM base

WORKDIR /myapp

COPY --from=production-deps /myapp/node_modules /myapp/node_modules
COPY --from=build /myapp/node_modules/.prisma /myapp/node_modules/.prisma

COPY --from=build /myapp/build/client /myapp/build/bot
COPY --from=build /myapp/build/server /myapp/build/server
COPY --from=build /myapp/build/client /myapp/build/client
ADD . .

CMD ["npm", "run", "start:production"]
