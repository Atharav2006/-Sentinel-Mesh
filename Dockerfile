# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Install Node.js (required for snarkjs zero-knowledge prover)
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir -r api/requirements.txt
RUN pip install --no-cache-dir -r scorer/requirements.txt || true

# Install Node.js dependencies
WORKDIR /app/zkp
RUN npm install

# Go back to root
WORKDIR /app

# Set Environment Variables for Production
ENV HOSTED=true
ENV PYTHONUNBUFFERED=1

# Expose the port the app runs on
EXPOSE 8000

# Run Uvicorn when the container launches
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
