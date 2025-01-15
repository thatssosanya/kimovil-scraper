# --- BUILD STAGE ---
FROM node:18 AS builder

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

# --- RUNTIME STAGE ---
FROM node:18-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

ENV ENV production
ENV NODE_ENV production

CMD ["node", "./dist/index.js"]