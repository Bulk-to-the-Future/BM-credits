FROM node:22.11-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8080

CMD ["sh", "-c", "pnpm start -p ${PORT}"]
