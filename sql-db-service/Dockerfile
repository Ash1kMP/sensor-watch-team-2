# Use the official Postgres base image
FROM postgres:15-alpine

# Set environment variables (you can override at runtime)
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=admin
ENV POSTGRES_DB=sensorwatch-userDB

# Copy initialization SQL script into the container
COPY init.sql /docker-entrypoint-initdb.d/

# Expose default Postgres port
EXPOSE 5432

# The entrypoint and CMD are already defined by postgres image
