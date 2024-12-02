FROM node:20.12.0
LABEL authors="daechanjo"

WORKDIR /app

COPY package*.json ./
COPY . .

COPY .env .env

RUN npm install

RUN npm run build

EXPOSE 9999

CMD ["npm", "run", "start:prod"]
