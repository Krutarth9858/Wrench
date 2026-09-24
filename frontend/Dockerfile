# Stage 1: Build the Vite + React TypeScript single page application
FROM node:22-alpine AS builder

WORKDIR /app

# Configure default API base URL for build time
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

ARG VITE_CARTO_API_KEY=cb1_33v3_1_7aec5765d302ee1f12be9827
ENV VITE_CARTO_API_KEY=$VITE_CARTO_API_KEY

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --ignore-scripts

COPY . .
RUN npx vite build

# Stage 2: Serve production assets via Nginx with reverse proxy
FROM nginx:1.25-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
