FROM node:22.11-slim

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

RUN npm i -g pnpm@9.15.4

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 8080

CMD ["sh", "-c", "pnpm start -p ${PORT}"]
