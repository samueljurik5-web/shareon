# Build context: repository root
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace server --include-workspace-root
COPY server server
RUN npx --workspace server prisma generate && npm run build --workspace server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server server
WORKDIR /app/server
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 4000
# Apply migrations, then start. Seeding is a separate, explicit step (see README).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
