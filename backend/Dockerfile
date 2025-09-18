FROM python:3.12-slim

WORKDIR /app

# System dependencies are not required because we use psycopg2-binary

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Add entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port
EXPOSE 8001

# Command to seed data then start server
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
