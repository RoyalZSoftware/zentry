FROM node:20-alpine

WORKDIR /app

COPY server.js tracker.js ./

EXPOSE 8080

CMD ["node", "server.js"]
