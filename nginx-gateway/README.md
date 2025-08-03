# NGINX Gateway for SensorWatch

This document provides instructions on how to set up and run the NGINX API gateway for the SensorWatch application.

## Overview

The NGINX gateway serves as the entry point for all API requests in the SensorWatch application. It routes requests to the appropriate backend services, ensuring efficient communication between the frontend and backend components.

## Prerequisites

- Ensure that Docker is installed on your machine.
- Familiarity with Docker and Docker Compose.

## Configuration

The NGINX configuration file is located at `nginx-gateway/nginx.conf`. This file defines the routing rules for the various services in the SensorWatch application.

## Running the Gateway

1. Navigate to the `nginx-gateway` directory:

   ```bash
   cd nginx-gateway
   ```

2. Build the Docker image for the NGINX gateway:

   ```bash
   docker build -t sensorwatch-nginx .
   ```

3. Start the NGINX gateway using Docker Compose:

   ```bash
   docker-compose up
   ```

4. Access the API gateway at `http://localhost:80`.

## Service Routing

The NGINX gateway routes requests to the following services:

- **DB Service**: Handles database operations.
- **Backend Service**: Manages authentication and business logic.
- **Mock ESP32 Service**: Simulates the ESP32 device emitting data.
- **Queue Service**: Manages message queuing and notifications.
- **Discovery Service**: Monitors the health of all services.

## Health Monitoring

The NGINX gateway integrates with the discovery service to ensure that all backend services are operational. If a service is down, the gateway will return an appropriate error response.

## Conclusion

The NGINX API gateway is a crucial component of the SensorWatch application, facilitating communication between the frontend and backend services. Follow the instructions above to set up and run the gateway effectively.