FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install client dependencies and build
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Copy server code
COPY server/ ./server/

# Create uploads directory
RUN mkdir -p server/uploads

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
