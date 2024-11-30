FROM node:20-buster
WORKDIR /app
COPY . .
RUN npm install
ENV NODE_ENV=production
CMD [ "npm", "run", "start"]
