#!/bin/sh
# Runs alongside CouchDB — waits for it to start, then creates system databases.

COUCH_URL="http://127.0.0.1:5984"

echo "Waiting for CouchDB to start..."
until curl -sf "${COUCH_URL}/" > /dev/null 2>&1; do
  sleep 1
done
echo "CouchDB is ready."

curl -sf -X PUT "${COUCH_URL}/_users" -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" || true
curl -sf -X PUT "${COUCH_URL}/_replicator" -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" || true
curl -sf -X PUT "${COUCH_URL}/_global_changes" -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" || true

echo "System databases created."
