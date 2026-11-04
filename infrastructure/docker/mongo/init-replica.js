// Initialise the single-node MongoDB replica set used by talent-service and
// notification-service. Safe to re-run: an existing replica set is left alone.
try {
  rs.status();
  print('replica set rs0 already initialised');
} catch (error) {
  print('initialising replica set rs0');
  printjson(
    rs.initiate({
      _id: 'rs0',
      members: [{ _id: 0, host: 'mongodb:27017' }],
    }),
  );
}

// Wait briefly for this member to become primary so dependent scripts can
// immediately start writing.
for (let attempt = 0; attempt < 30; attempt += 1) {
  if (db.hello().isWritablePrimary) {
    print('replica set primary ready');
    quit(0);
  }
  sleep(1000);
}

print('warning: replica set primary was not ready after 30s');
quit(1);
