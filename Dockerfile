# syntax=docker/dockerfile:1
# Rituel : une seule image — la PWA (dist/) et l'API de sync, même origine.

# ---- front : build de la PWA (Vite) ----
FROM node:22-alpine AS front
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Sync active en prod : l'app parle à son propre serveur.
ARG VITE_SYNC_URL=https://rituel.marco-studio.fr
ENV VITE_SYNC_URL=$VITE_SYNC_URL
RUN npm run build

# ---- serveur : API Hono + better-sqlite3 (compilation native si besoin) ----
FROM node:22-alpine AS serveur
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# ---- run : image finale ----
FROM node:22-alpine AS run
WORKDIR /app
# tzdata : sans elle TZ=Europe/Paris retombe sur UTC
RUN apk add --no-cache tzdata
ENV NODE_ENV=production \
    TZ=Europe/Paris \
    PORT=8787 \
    DB_PATH=/app/data/rituel.db \
    STATIC_DIR=/app/public
# Commit déployé, exposé par /sante (passé par deploy.sh ; « inconnu » sinon).
ARG GIT_SHA=inconnu
ENV APP_COMMIT=$GIT_SHA
COPY --from=serveur /app/package.json ./
COPY --from=serveur /app/node_modules ./node_modules
COPY --from=serveur /app/dist ./dist
COPY --from=front /app/dist ./public
# L'app ne tourne pas en root ; data/ (volume de l'hôte) est rendu à node au déploiement.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/sante >/dev/null || exit 1
CMD ["node", "dist/index.js"]
