FROM couchdb:latest

COPY setup-databases.sh /opt/couchdb/scripts/setup-databases.sh
RUN chmod +x /opt/couchdb/scripts/setup-databases.sh

CMD /opt/couchdb/scripts/setup-databases.sh & /docker-entrypoint.sh /opt/couchdb/bin/couchdb
