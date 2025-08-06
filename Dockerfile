# Use official Node.js image
FROM node:20

# Install yt-dlp
RUN apt-get update && apt-get install -y yt-dlp

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first for caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Expose port
EXPOSE 5000

# Start the app
CMD ["npm", "start"]
