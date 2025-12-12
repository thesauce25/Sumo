import requests
import time
import random

API_URL = "https://sumo-server-1056239062336.us-central1.run.app/api"

def run_fight():
    print(f"Starting fight on {API_URL}...")
    
    # 1. Start Match
    resp = requests.post(f"{API_URL}/match", json={"p1_id": "1", "p2_id": "2"})
    if resp.status_code != 200:
        print("Failed to start match:", resp.text)
        return
    
    match_data = resp.json()
    match_id = match_data['match_id']
    print(f"Match started: {match_id}")
    print("Waiting 5s for spectator to connect...")
    time.sleep(5)
    
    # 2. Loop Actions
    print("FIGHT START! Sending actions...")
    for i in range(30):
        # Randomly choose wrestler to act to simulate struggle
        w_id = "1" if random.random() > 0.5 else "2"
        action = "kiai"
        
        try:
            requests.post(f"{API_URL}/fight/action", json={
                "wrestler_id": w_id,
                "action": action
            }, timeout=1)
            print(f"Action: {w_id} {action}")
        except Exception as e:
            print(f"Error: {e}")
            
        time.sleep(0.3) # Action every 300ms
        
    print("Fight simulation complete.")

if __name__ == "__main__":
    run_fight()
