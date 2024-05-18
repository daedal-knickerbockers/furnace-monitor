#!/bin/bash

# Export all pins where consumer sensors are connected
# and set them to input mode
# Copy the following two lines for every pin
echo {PIN_NUMBER} > /sys/class/gpio/export
echo in > /sys/class/gpio/gpio{PIN_NUMBER}/direction

# Start the docker container for the actual program
# Set the path to the docker-compose.yml file accordingly
docker compose -f /path/to/docker-compose.yml up -d

# Thats it, the application should be running now