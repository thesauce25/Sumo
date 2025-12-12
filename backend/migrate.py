import sqlite3
import requests
import json
import os
import time

SQLITE_DB = '../sumo_data.db'
API_URL = 'https://sumo-server-1056239062336.us-central1.run.app/api'

def migrate_wrestlers():
    print(f"Migrating wrestlers to {API_URL}...")
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers')
    rows = c.fetchall()
    
    count = 0
    errors = 0
    for row in rows:
        data = dict(row)
        # Ensure ID is treated as string if needed, but API accepts dict
        try:
            res = requests.post(f"{API_URL}/wrestlers", json=data)
            if res.status_code not in [200, 201]:
                print(f"  Error uploading {data['name']}: {res.status_code} {res.text}")
                errors += 1
            else:
                count += 1
                if count % 10 == 0: print(f"  Uploaded {count} wrestlers...")
        except Exception as e:
            print(f"  Exception: {e}")
            errors += 1
            
        time.sleep(0.05) # Rate limit slightly
            
    conn.close()
    print(f"Done. Migrated {count} wrestlers. Errors: {errors}")

if __name__ == "__main__":
    if not os.path.exists(SQLITE_DB):
        print(f"Error: {SQLITE_DB} not found on path.")
    else:
        # Retry logic for server startup
        print("Waiting for server to be ready...")
        try:
            requests.get(API_URL.replace('/api', ''))
            migrate_wrestlers()
        except:
            print("Server not ready yet. Try running this script again after deployment finishes.")
