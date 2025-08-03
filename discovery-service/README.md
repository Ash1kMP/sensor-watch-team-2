# Discovery Service

The Discovery Service is responsible for monitoring the health of all services in the SensorWatch application. It periodically checks the status of each service and reports any issues.

## Setup Instructions

1. **Clone the Repository**
   Clone the SensorWatch repository to your local machine.

   ```bash
   git clone <repository-url>
   cd sensorwatch/discovery-service
   ```

2. **Install Dependencies**
   Use npm to install the required dependencies.

   ```bash
   npm install
   ```

3. **Configuration**
   Configure the service to monitor the appropriate endpoints of your other services. This may involve setting environment variables or modifying configuration files.

4. **Run the Service**
   Start the discovery service using the following command:

   ```bash
   npm start
   ```

5. **Health Monitoring**
   The service will begin monitoring the health of the other services. You can check the logs for status updates and any detected issues.

## API Endpoints

- **GET /health**
  - Returns the health status of the discovery service.

- **GET /services**
  - Returns the status of all monitored services.

## Notes

- Ensure that all services are running and accessible for the discovery service to function correctly.
- Consider integrating alerting mechanisms for critical failures detected by the discovery service.

## License

This project is licensed under the MIT License. See the LICENSE file for details.