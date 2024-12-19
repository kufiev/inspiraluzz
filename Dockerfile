FROM node:20-buster
WORKDIR /app
COPY . .
RUN npm install
ENV NODE_ENV=production
ENV CLOUD_STORAGE_BUCKET=inspiraluzz-media
CMD [ "npm", "run", "start"]
