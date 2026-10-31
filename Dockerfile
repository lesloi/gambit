# syntax=docker/dockerfile:1

# The app is a static build: the browser holds the data, the engine and the service worker.
# The runtime image only serves files, so it needs neither Node nor a backend.

FROM node:26-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# Node 26 ships no Corepack, so pnpm is installed at the version package.json pins.
RUN npm install --global --no-audit --no-fund "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile
# One copy for the rest of the inputs: an enumerated list had silently stopped matching the build
# when content/ appeared, and the release only failed once it reached main. .dockerignore holds
# back what the build does not read, and only dist/ leaves this stage.
COPY . .
RUN pnpm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine AS runtime
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
