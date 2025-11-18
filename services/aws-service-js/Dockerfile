# Use an official Node.js runtime as a parent image
FROM node:16-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install any needed packages
RUN npm install

# Bundle app source
COPY . .

RUN mkdir -p /usr/src/app/src/data

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Define the command to run your app
CMD [ "npm", "start" ]
