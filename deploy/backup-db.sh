#!/bin/bash
# Stock Tracker Database Backup Script
# Location: /root/backup-db.sh
# Cron: 0 2 * * * /root/backup-db.sh
#
# Install:
#   cp backup-db.sh /root/
#   chmod +x /root/backup-db.sh
#   echo "0 2 * * * /root/backup-db.sh" | crontab -

set -e

# Configuration
APP_DIR="/var/www/stock-tracker"
DB_FILE="$APP_DIR/backend/data/stock_tracker.db"
BACKUP_DIR="/var/backups/stock-tracker"
RETENTION_DAYS=7

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Generate timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/stock_tracker_$DATE.db"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file not found: $DB_FILE"
    exit 1
fi

# Create backup using SQLite's backup command (safer for WAL mode)
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Compress the backup
gzip "$BACKUP_FILE"

# Remove old backups (older than retention days)
find "$BACKUP_DIR" -name "stock_tracker_*.db.gz" -mtime +$RETENTION_DAYS -delete

# Log success
echo "$(date): Backup created: ${BACKUP_FILE}.gz" >> "$BACKUP_DIR/backup.log"

# Optional: Report backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "$(date): Backup size: $BACKUP_SIZE" >> "$BACKUP_DIR/backup.log"
