FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

COPY apps/backend apps/backend
RUN npm run build --workspace @start-back/backend

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build /app/apps/backend/.next/standalone ./
COPY --from=build /app/apps/backend/.next/static ./apps/backend/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/backend/server.js"]

