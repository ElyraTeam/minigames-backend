# ---- Base image ----
FROM node:24-slim AS base
ENV PNPM_VERSION=10.26.2
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y && apt-get install -y openssl wget bash curl python3 python3-pip build-essential \
    && curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.deb.sh' | bash \
    && apt-get update && apt-get install -y infisical \
    && npm install -g corepack@latest \
    && corepack enable && corepack use pnpm@${PNPM_VERSION} \
    && mkdir -p $PNPM_HOME && chown node:node $PNPM_HOME
WORKDIR /app
RUN chown node:node /app


# ---- Dependencies ----
FROM base AS deps
COPY --chown=node:node package.json pnpm-lock.yaml /app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prefer-offline --frozen-lockfile --dangerously-allow-all-builds 
ENV PATH=/app/node_modules/.bin:$PATH


# ---- Build ----
FROM base AS build
COPY --chown=node:node . /app
COPY --chown=node:node --from=deps /app/node_modules /app/node_modules
RUN pnpm run build


# ---- Source (for prod/dev split) ----
FROM base AS source
COPY --chown=node:node package.json pnpm-lock.yaml /app/
COPY --chown=node:node --from=build /app/dist /app/dist
COPY --chown=node:node --from=build /app/static /app/static
COPY --chown=node:node --from=build /app/src/instrument.mjs /app/instrument.mjs
COPY --chown=node:node --from=deps /app/node_modules /app/node_modules


# ---- Production ----
FROM source AS prod
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PATH=/app/node_modules/.bin:$PATH
RUN pnpm prune --prod
ENV NODE_OPTIONS="--import ./instrument.mjs"
# pm2 should be a dependency in package.json, not installed globally
CMD [ "pm2-runtime", "start", "dist/app.js" ]



# ---- Development ----
FROM source AS dev
ENV PATH=/app/node_modules/.bin:$PATH
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
CMD ["pnpm", "dev"]