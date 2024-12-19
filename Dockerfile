FROM node:20-buster
WORKDIR /app
COPY . .
RUN npm install
ENV NODE_ENV=production
ENV CLOUD_STORAGE_BUCKET={bucket_name}
CMD [ "npm", "run", "start"]
