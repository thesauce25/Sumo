FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
# (We might need build-essential for some python packages)
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy logic
COPY . .

# Expose port
EXPOSE 8080

# Run Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
