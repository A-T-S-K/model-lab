FROM node:24-alpine AS build
WORKDIR /model-lab
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && test ! -e node_modules/@playwright \
  && test ! -e node_modules/playwright \
  && test ! -e node_modules/playwright-core

COPY index.html tsconfig.json tsconfig.container.json ./
COPY scripts/runtime-identity.mjs scripts/runtime-identity.mjs
COPY model model
COPY trace trace
COPY inspect inspect
COPY archive archive
COPY experiments experiments
COPY app app
COPY fixtures/canonical.initial.json fixtures/noncanonical.initial.json fixtures/
COPY research/pythia/adapter.py \
  research/pythia/server.py \
  research/pythia/requirements.lock \
  research/pythia/dependencies.json \
  research/pythia/model-lock.json \
  research/pythia/profile.json \
  research/pythia/profile-generation.json \
  research/pythia/source.json \
  research/pythia/profile-legacy.json \
  research/pythia/
COPY research/witnesses/mlp.py \
  research/witnesses/adapter.py \
  research/witnesses/fixtures.py \
  research/witnesses/profile.json \
  research/witnesses/

RUN npm run build:container

FROM nginx:1.28-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /model-lab/dist /usr/share/nginx/html
EXPOSE 80
