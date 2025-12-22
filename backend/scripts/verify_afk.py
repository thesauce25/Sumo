
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.core.engine import SumoEngine

def test_afk_win():
    print("Testing: Aggressor vs AFK Dummy...")
    engine = SumoEngine(simulation_mode=True)
    engine.set_wrestlers(
        {"id": "p1", "name": "Aggressor", "color": "255,0,0"},
        {"id": "p2", "name": "Dummy", "color": "0,0,255"}
    )
    engine.force_start()
    
    # Simulate 60fps
    dt = 1/60.0
    time_elapsed = 0
    max_time = 30.0 # Should win way before this
    
    inputs_per_sec = 10
    input_interval = 1.0 / inputs_per_sec
    last_input = 0
    
    while not engine.game_over and time_elapsed < max_time:
        # P1 Mashes Push
        if time_elapsed - last_input > input_interval:
            engine.handle_input("p1", "PUSH")
            last_input = time_elapsed
            
        # P2 Does NOTHING (AFK)
        
        engine.tick(dt)
        time_elapsed += dt
        
    if engine.game_over:
        print(f"✅ SUCCESS: Match ended in {time_elapsed:.2f}s")
        print(f"Winner: {engine.winner_id}")
        if engine.winner_id == "p1":
             print("Result: Aggressor Won (Correct)")
        else:
             print("Result: WTF? Dummy Won?")
    else:
        print(f"❌ FAILED: Match did not end in {max_time}s")

if __name__ == "__main__":
    test_afk_win()
