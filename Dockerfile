# base node image
FROM node:20-alpine as base

# install node modules, including dev dependencies
FROM base as deps

WORKDIR /app

COPY package.json ./

RUN  npm install

# setup production dependencies
FROM base as production-deps

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm ci --omit=dev

# build the app
FROM base as build

WORKDIR /app

COPY . .

COPY --from=deps /app/node_modules /app/node_modules

RUN npm run build

# final stage
FROM base

WORKDIR /app

COPY --from=production-deps /app/node_modules /app/node_modules

COPY --from=build /app/dist /app/dist

WORKDIR /app/dist
CMD [ "node", "index.js" ]

# Volume that holds the database and file exports
VOLUME [ "/var/data"]   

# Volume that holds the configuration files
VOLUME [ "/var/config"]

# Volume that maps to the gpio directories of the raspberry pi
VOLUME [ "/var/gpio"]