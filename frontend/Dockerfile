FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_NAKAMA_HOST=localhost
ARG VITE_NAKAMA_PORT=7350
ARG VITE_NAKAMA_SERVER_KEY=defaultkey
ARG VITE_NAKAMA_USE_SSL=false
ENV VITE_NAKAMA_HOST=$VITE_NAKAMA_HOST
ENV VITE_NAKAMA_PORT=$VITE_NAKAMA_PORT
ENV VITE_NAKAMA_SERVER_KEY=$VITE_NAKAMA_SERVER_KEY
ENV VITE_NAKAMA_USE_SSL=$VITE_NAKAMA_USE_SSL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
