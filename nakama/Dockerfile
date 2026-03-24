FROM node:22-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json rollup.config.js babel.config.json ./
COPY src ./src
RUN npm run build

FROM heroiclabs/nakama:3.22.0
RUN mkdir -p /nakama/data/modules/build
COPY --from=builder /build/build/index.js /nakama/data/modules/build/index.js
COPY local.yml /nakama/data/local.yml
