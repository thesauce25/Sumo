import sys
import os
import time
import random
import statistics

# Add the parent directory to sys.path to import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.engine import SumoEngine, STATE_FIGHTING, STATE_GAME_OVER

# Simulation Constants
SIMULATION_FPS = 60
INPUTS_PER_SECOND = 8  # "Reasonable human" mashing speed (8 taps/sec)
INPUT_INTERVAL = 1.0 / INPUTS_PER_SECOND
NUM_MATCHES = 50

def run_single_match(match_index):
    engine = SumoEngine()
    
    # Force start to skip tachiai sync for simulation
    engine.force_start()
    
    # Initialize simulation variables
    time_elapsed = 0.0
    last_p1_input = 0.0
    last_p2_input = 0.0
    
    while not engine.game_over:
        # Tick the engine
        dt = 1.0 / SIMULATION_FPS
        engine.tick(dt)
        time_elapsed += dt
        
        # Simulate P1 Inputs
        if time_elapsed - last_p1_input >= INPUT_INTERVAL:
            # Add some jitter to human input
            if random.random() > 0.1: # 90% chance to hit the button on rhythm
                engine.handle_input("p1", "PUSH")
            last_p1_input = time_elapsed
            
        # Simulate P2 Inputs
        if time_elapsed - last_p2_input >= INPUT_INTERVAL:
            if random.random() > 0.1:
                engine.handle_input("p2", "PUSH")
            last_p2_input = time_elapsed
            
        # Safety break for infinite loops
        if time_elapsed > 120.0:
            return 120.0, "DRAW (Timeout)"
            
    return time_elapsed, engine.winner_id

def main():
    print(f"--- Sumo Physics Simulation ---")
    print(f"Target: 20-30s match duration")
    print(f"Inputs: ~{INPUTS_PER_SECOND}/sec per player")
    print(f"Running {NUM_MATCHES} matches...\n")
    
    durations = []
    
    for i in range(NUM_MATCHES):
        duration, winner = run_single_match(i)
        durations.append(duration)
        # print(f"Match {i+1}: {duration:.2f}s - Winner: {winner}")
        
    avg_duration = statistics.mean(durations)
    max_duration = max(durations)
    min_duration = min(durations)
    
    print(f"\n--- Results ---")
    print(f"Average Duration: {avg_duration:.2f}s")
    print(f"Min Duration:     {min_duration:.2f}s")
    print(f"Max Duration:     {max_duration:.2f}s")
    
    if 20.0 <= avg_duration <= 30.0:
        print("\n✅ SUCCESS: Duration is within target range.")
    elif avg_duration < 20.0:
        print("\n❌ TOO FAST: Reduce push force or increase resistance/friction.")
        print(f"Current PUSH_FORCE: {SumoEngine.PUSH_FORCE_PER_INPUT}")
        print(f"Current FRICTION: {SumoEngine.FRICTION}")
    else:
        print("\n❌ TOO SLOW: Increase push force or reduce resistance.")

if __name__ == "__main__":
    main()
