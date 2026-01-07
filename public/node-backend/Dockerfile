# GIS Automation Hub - Node.js Backend
# This Dockerfile creates a hybrid Node.js + Python environment

FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic links for python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create Python virtual environment (optional, for non-ArcPy dependencies)
RUN python -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Expose port
EXPOSE 5000

# Environment variables
ENV PORT=5000
ENV NODE_ENV=production
# Override with your ArcGIS Pro Python path when running locally
# ENV ARCPY_PYTHON_PATH="C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["npm", "start"]
