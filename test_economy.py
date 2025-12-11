import sqlite3
import constants as C
from sumo_game import record_win, init_db, generate_random_wrestler

def create_test_wrestler(name, rank_idx=0):
    conn = sqlite3.connect(C.DB_FILE)
    c = conn.cursor()
    # Basic creation
    data = generate_random_wrestler()
    c.execute('''INSERT INTO wrestlers 
              (name, custom_name, stable, height, weight, strength, technique, speed, color, bio, avatar_seed, xp, rank_index, skill_points)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', 
              (data[0], name, data[1], data[2], data[3], data[4], data[5], data[6], data[7], "Bio", 0, 
               0, rank_idx, 0)) # Start with 0 XP/SP
    
    # If high rank requested, give enough XP
    if rank_idx > 0:
        xp = C.WRESTLER_RANKS[rank_idx]['xp_required']
        c.execute('UPDATE wrestlers SET xp = ?, rank_index = ? WHERE name = ?', 
                  (xp, rank_idx, name))
        
    w_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": w_id, "name": name}

def get_stats(w_id):
    conn = sqlite3.connect(C.DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM wrestlers WHERE id = ?', (w_id,))
    row = c.fetchone()
    conn.close()
    return dict(row)

def simulate_campaign(matches=50):
    print(f"\n--- Simulating {matches} Match Campaign ---")
    init_db()
    
    # Create our hero
    hero = create_test_wrestler("Hero")
    # Create generic jobber opponent
    jobber = create_test_wrestler("Jobber")
    
    print(f"Hero Start: {get_stats(hero['id'])['skill_points']} SP, {get_stats(hero['id'])['xp']} XP")
    
    for i in range(1, matches + 1):
        # Win against jobber
        record_win(hero, jobber)
        
        stats = get_stats(hero['id'])
        rank_name = C.WRESTLER_RANKS[stats['rank_index']]['name']
        print(f"Match {i}: {stats['name']} is {rank_name} ({stats['xp']} XP, {stats['skill_points']} SP)")
        
        # Verify Ranks
        if stats['rank_index'] > 0 and i == 1:
            print("  [!] Warning: Ranked up too fast?")
            
    final_stats = get_stats(hero['id'])
    print("\n--- Campaign Result ---")
    print(f"Rank: {C.WRESTLER_RANKS[final_stats['rank_index']]['name']}")
    print(f"XP: {final_stats['xp']}")
    print(f"SP: {final_stats['skill_points']}")
    
    # Check against targets
    # 50 victories -> ~50 * 50 XP = 2500 XP (Should be Maegashira/Komusubi range)
    # 50 wins * ~2 SP = 100 SP (Should unlock ~3 full branches or one full legend branch)
    
if __name__ == "__main__":
    simulate_campaign()
