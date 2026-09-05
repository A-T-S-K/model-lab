FROM node:24-alpine AS build
WORKDIR /model-lab
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.28-alpine
COPY --from=build /model-lab/dist /usr/share/nginx/html
EXPOSE 80
