# Stock Tracker - Combined Frontend + Backend Docker Image
# For deployment to Zeabur (Hong Kong region)

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine
WORKDIR /app

# Install nginx and build tools for native modules (better-sqlite3)
RUN apk add --no-cache nginx python3 make g++

# Copy backend
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./

# Remove build tools to reduce image size
RUN apk del python3 make g++

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist /app/public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Copy nginx config
COPY deploy/nginx-fly.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port (Fly.io uses 8080 by default)
EXPOSE 8080

# Start both nginx and node
CMD ["/app/start.sh"]
