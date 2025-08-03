FROM rabbitmq:3.13.7-management-alpine

# Set environment variables for RabbitMQ
ENV RABBITMQ_DEFAULT_USER=user
ENV RABBITMQ_DEFAULT_PASS=password

# Expose the RabbitMQ ports
EXPOSE 4369 5671 5672 15671 15672 25672

# Start RabbitMQ server
CMD ["rabbitmq-server"]