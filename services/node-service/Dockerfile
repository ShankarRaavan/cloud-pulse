FROM node:16-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache sqlite python3 make g++ && npm install

COPY src ./src

# Copy frontend files will be handled by docker-compose context

EXPOSE 3000

CMD ["npm", "start"]
