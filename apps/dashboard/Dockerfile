FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SHOPSPHERE_API=http://localhost:8000
ARG VITE_ANALYSIS_API=http://localhost:8002
ENV VITE_SHOPSPHERE_API=$VITE_SHOPSPHERE_API
ENV VITE_ANALYSIS_API=$VITE_ANALYSIS_API
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["npm", "run", "preview"]