# ==========================================
# Multi-stage Dockerfile for SparkLoop Frontend
# Framework: React 18 + Vite + TailwindCSS
# ==========================================

# Stage 1: Build Static Web Assets
FROM node:22-alpine AS build
WORKDIR /app

# Build Argument for Backend API Base URL
ARG VITE_API_BASE_URL=https://sloopapi.mydev-lab.com/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package dependency manifests for layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy entire frontend source code and execute production build
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve Optimized Static Bundle via Nginx
FROM nginx:1.27-alpine AS final

# Remove default static files
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
