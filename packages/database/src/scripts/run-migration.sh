#!/bin/bash

# Load environment variables from .env if present
if [ -f "../../.env" ]; then
    export $(cat ../../.env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set."
    echo "Please set it in the .env file or export it directly."
    exit 1
fi

# Run the SQL migration
echo "Running migration to add columns to subsidiaries table..."
psql "$DATABASE_URL" -f add-subsidiary-columns.sql

# Check if the migration was successful
if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Migration failed. Please check the error message above."
    exit 1
fi