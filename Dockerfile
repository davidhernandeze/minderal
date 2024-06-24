# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the Vue.js application
RUN npm run build

# Install a web server to serve the built files
RUN npm install -g serve

# Expose port 5001 to the outside world
EXPOSE 5001

# Command to run the application
CMD ["serve", "-s", "dist", "-l", "5001"]

