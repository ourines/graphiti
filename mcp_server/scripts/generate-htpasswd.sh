#!/bin/bash

# Generate .htpasswd file for Nginx authentication
# This script generates a password file for basic authentication
#
# Usage:
#   ./generate-htpasswd.sh <username>
#
# Example:
#   ./generate-htpasswd.sh admin

set -e

USERNAME="${1}"

if [ -z "$USERNAME" ]; then
    echo "Usage: $0 <username>"
    echo ""
    echo "Example:"
    echo "  $0 admin"
    exit 1
fi

# Check if htpasswd is available
if ! command -v htpasswd &> /dev/null; then
    echo "Error: htpasswd command not found"
    echo ""
    echo "Install options:"
    echo "  macOS:   brew install httpd"
    echo "  Ubuntu:  sudo apt-get install apache2-utils"
    echo "  CentOS:  sudo yum install httpd-tools"
    echo ""
    echo "Alternatively, use online generator:"
    echo "  https://hostingcanada.org/htpasswd-generator/"
    exit 1
fi

OUTPUT_FILE="../.htpasswd"

echo "Generating .htpasswd file for user: $USERNAME"
htpasswd -c "$OUTPUT_FILE" "$USERNAME"

if [ $? -eq 0 ]; then
    echo ""
    echo "Success! Password file created at: $OUTPUT_FILE"
    echo ""
    echo "To add more users (without -c flag to avoid overwriting):"
    echo "  htpasswd $OUTPUT_FILE <another_username>"
else
    echo "Error: Failed to generate password file"
    exit 1
fi
