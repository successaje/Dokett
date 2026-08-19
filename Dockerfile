# Runtime image for the always-on services: Lens (read API) and keeper.
#
# Both are plain Node processes reading Foundry-independent JS (lens/, worker/,
# relay/), so this image never touches forge or solc — that keeps it small and
# keeps a Solidity toolchain out of the deployed attack surface.
FROM node:22-slim

WORKDIR /app

# Root package.json pulls in ethers, the ASC SDK, etc. — shared by lens/worker/relay.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY lens ./lens
COPY worker ./worker
COPY relay ./relay

# No CMD: fly.toml's [processes] selects lens vs keeper per Fly app, so one
# image serves both without a shell-script dispatcher to keep in sync.
