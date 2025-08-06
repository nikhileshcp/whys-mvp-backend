# Use official Node.js image
FROM node:20

# Install yt-dlp and ffmpeg (needed for some postprocessing)
RUN apt-get update && apt-get install -y yt-dlp ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy remaining files
COPY . .

# Expose port
EXPOSE 10000

# Start app (Render injects PORT env var)
CMD ["npm", "start"]
