FROM node:22.11-slim

# Cloud Run environment
ENV NODE_ENV=production
ENV PORT=8080

# Set working directory
WORKDIR /app

# Install pnpm directly (avoid corepack issues)
RUN npm install -g pnpm@9.15.4

# Copy dependency manifests only (prevents pnpm workspace issues)
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build the Next.js app
RUN pnpm build

# Cloud Run listens on port 8080
EXPOSE 8080

# Start the server
CMD ["sh", "-c", "pnpm start -p ${PORT}"]
