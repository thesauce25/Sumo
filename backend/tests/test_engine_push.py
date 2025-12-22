"""
Unit tests for the SumoEngine push direction mechanics.
Verifies that pressing PUSH moves the OPPONENT (not the pusher).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.engine import SumoEngine, STATE_FIGHTING


def test_p1_push_moves_p2_right():
    """
    When P1 (left side) pushes, P2 (right side) should move further right (positive X).
    Wrestlers must be within HIT_RANGE (6.0) for push to affect opponent.
    """
    engine = SumoEngine()
    
    # Set up wrestlers with known IDs
    p1_data = {"id": "wrestler_A", "name": "TestP1", "strength": 1.0}
    p2_data = {"id": "wrestler_B", "name": "TestP2", "strength": 1.0}
    engine.set_wrestlers(p1_data, p2_data)
    
    # Force into fighting state
    engine.state = STATE_FIGHTING
    
    # Move wrestlers close enough (within HIT_RANGE of 6.0)
    engine.p1['x'] = 30.0
    engine.p2['x'] = 34.0  # 4 pixels apart (< 6.0 HIT_RANGE)
    
    # Record initial positions
    p2_initial_x = engine.p2['x']
    p1_initial_x = engine.p1['x']
    
    print(f"Initial: P1 x={p1_initial_x:.2f}, P2 x={p2_initial_x:.2f}")
    
    # P1 pushes using directional action
    engine.handle_input("wrestler_A", "PUSH_RIGHT")
    
    # Allow physics to apply (tick advances velocity into position)
    engine.tick(1/60.0)
    
    print(f"After push: P1 x={engine.p1['x']:.2f}, P2 x={engine.p2['x']:.2f}")
    
    # P2 should have moved right (increased x)
    assert engine.p2['x'] > p2_initial_x, \
        f"P2 should move right! Was {p2_initial_x:.2f}, now {engine.p2['x']:.2f}"
    
    # P1 should NOT have moved significantly (pusher stays still)
    assert abs(engine.p1['x'] - p1_initial_x) < 0.5, \
        f"P1 should stay put! Was {p1_initial_x:.2f}, now {engine.p1['x']:.2f}"
    
    print("✓ P1 push moves P2 right - PASS")


def test_p2_push_moves_p1_left():
    """
    When P2 (right side) pushes, P1 (left side) should move further left (negative X).
    Wrestlers must be within HIT_RANGE (6.0) for push to affect opponent.
    """
    engine = SumoEngine()
    
    # Set up wrestlers with known IDs
    p1_data = {"id": "wrestler_A", "name": "TestP1", "strength": 1.0}
    p2_data = {"id": "wrestler_B", "name": "TestP2", "strength": 1.0}
    engine.set_wrestlers(p1_data, p2_data)
    
    # Force into fighting state
    engine.state = STATE_FIGHTING
    
    # Move wrestlers close enough (within HIT_RANGE of 6.0)
    engine.p1['x'] = 30.0
    engine.p2['x'] = 34.0  # 4 pixels apart (< 6.0 HIT_RANGE)
    
    # Record initial positions
    p1_initial_x = engine.p1['x']
    p2_initial_x = engine.p2['x']
    
    print(f"Initial: P1 x={p1_initial_x:.2f}, P2 x={p2_initial_x:.2f}")
    
    # P2 pushes using directional action
    engine.handle_input("wrestler_B", "PUSH_LEFT")
    
    # Allow physics to apply
    engine.tick(1/60.0)
    
    print(f"After push: P1 x={engine.p1['x']:.2f}, P2 x={engine.p2['x']:.2f}")
    
    # P1 should have moved left (decreased x)
    assert engine.p1['x'] < p1_initial_x, \
        f"P1 should move left! Was {p1_initial_x:.2f}, now {engine.p1['x']:.2f}"
    
    # P2 should NOT have moved significantly
    assert abs(engine.p2['x'] - p2_initial_x) < 0.5, \
        f"P2 should stay put! Was {p2_initial_x:.2f}, now {engine.p2['x']:.2f}"
    
    print("✓ P2 push moves P1 left - PASS")


def test_id_normalization():
    """
    Verify that ID comparison works with different types (int vs string).
    """
    engine = SumoEngine()
    
    # Set up with string IDs
    p1_data = {"id": "123", "name": "TestP1", "strength": 1.0}
    p2_data = {"id": "456", "name": "TestP2", "strength": 1.0}
    engine.set_wrestlers(p1_data, p2_data)
    engine.state = STATE_FIGHTING
    
    # Move wrestlers close enough (within HIT_RANGE of 6.0)
    engine.p1['x'] = 30.0
    engine.p2['x'] = 34.0
    
    p2_initial_x = engine.p2['x']
    
    # Send ID as integer - should still work due to normalization
    engine.handle_input(123, "PUSH_RIGHT")  # int instead of str
    engine.tick(1/60.0)
    
    assert engine.p2['x'] > p2_initial_x, \
        f"ID normalization failed! P2 didn't move."
    
    print("✓ ID normalization (int vs string) - PASS")


def test_skill_proc_strength():
    """
    Test that Strength skills (str_1) trigger higher force procs.
    Since it's RNG (15%), we'll force it by seeding or running defined iterations 
    until we see a variance, OR mock random in a real scenario.
    For this simple test, we'll assign the skill and check if ANY push exceeds normal bounds
    over many iterations, effectively testing the *possibility* of procs.
    """
    engine = SumoEngine()
    
    # P1 has Strength Skill, P2 has none
    p1_data = {
        "id": "p1", "name": "StrongMan", "strength": 1.0, 
        "unlocked_skills": [{"skill_id": "str_1"}]
    }
    p2_data = {"id": "p2", "name": "WeakMan", "strength": 1.0, "unlocked_skills": []}
    
    engine.set_wrestlers(p1_data, p2_data)
    engine.state = STATE_FIGHTING
    
    # Baseline push (no skills) approx 0.75 force
    # With proc (1.5x) -> 1.125
    
    overpower_count = 0
    iterations = 100
    
    for _ in range(iterations):
        # Reset positions
        engine.p1['x'] = 30.0
        engine.p2['x'] = 34.0
        p2_start_x = engine.p2['x']
        
        # P1 Pushes
        engine.handle_input("p1", "PUSH_RIGHT")
        engine.tick(1/60.0)
        
        dist_moved = engine.p2['x'] - p2_start_x
        
        # Detailed physics: Base 0.75 * 1.5 (Crit) = 1.125
        # Friction and mass might reduce it slightly but it should be distinct
        # Normal push is ~0.5 to 0.8 depending on variance
        if dist_moved > 0.9: 
            overpower_count += 1
            
    print(f"Strength Skill Procs: {overpower_count}/{iterations}")
    assert overpower_count > 0, "Strength skill should trigger at least some critical pushes!"


def test_skill_proc_stamina_drain():
    """
    Test that Technique skills cause stamina damage to opponent.
    """
    engine = SumoEngine()
    
    # P1 has Tech Skill
    p1_data = {
        "id": "p1", "name": "TechMan", "strength": 1.0, 
        "unlocked_skills": [{"skill_id": "tech_2"}] # Tier 2 = 20 dmg
    }
    p2_data = {"id": "p2", "name": "FatigueMan", "strength": 1.0, "unlocked_skills": []}
    
    engine.set_wrestlers(p1_data, p2_data)
    engine.state = STATE_FIGHTING
    
    # Force mock P2 stamina
    mock_stamina = 100.0
    engine.p2['stamina'] = mock_stamina
    
    drain_procs = 0
    iterations = 50
    
    for _ in range(iterations):
        # Reset P2 Stamina
        engine.p2['stamina'] = 100.0
        
        # P1 Pushes
        engine.handle_input("p1", "PUSH_RIGHT")
        
        # Check P2 stamina
        # Normal push shouldn't drain OPPONENT stamina (only pusher's)
        # But Tech Proc DOES drain opponent
        if engine.p2['stamina'] < 100.0:
            drain_procs += 1
            # Tier 2 drains 20
            # Note: tick also regens stamina, so we check immediately or ensure tick doesn't over-regen
            # We didn't call tick() yet, so regen hasn't happened. Action is immediate.
            assert engine.p2['stamina'] <= 80.0, "Tech Tier 2 should drain 20 stamina"
            
    print(f"Stamina Drain Procs: {drain_procs}/{iterations}")
    assert drain_procs > 0, "Technique skill should drain opponent stamina!"


if __name__ == "__main__":
    print("=" * 50)
    print("Running Push Direction Unit Tests")
    print("=" * 50)
    
    test_p1_push_moves_p2_right()
    print()
    test_p2_push_moves_p1_left()
    print()
    test_id_normalization()
    print()
    test_skill_proc_strength()
    print()
    test_skill_proc_stamina_drain()
    
    print()
    print("=" * 50)
    print("ALL TESTS PASSED ✓")
    print("=" * 50)
