FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN mkdir -p uploads logs
EXPOSE 5000
CMD ["node", "server.js"]
