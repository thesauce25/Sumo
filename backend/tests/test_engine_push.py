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
    P1 starts at x=22, P2 starts at x=42.
    After P1 pushes, P2's x should increase.
    """
    engine = SumoEngine()
    
    # Set up wrestlers with known IDs
    p1_data = {"id": "wrestler_A", "name": "TestP1", "strength": 1.0}
    p2_data = {"id": "wrestler_B", "name": "TestP2", "strength": 1.0}
    engine.set_wrestlers(p1_data, p2_data)
    
    # Force into fighting state
    engine.state = STATE_FIGHTING
    
    # Record initial positions
    p2_initial_x = engine.p2['x']
    p1_initial_x = engine.p1['x']
    
    print(f"Initial: P1 x={p1_initial_x:.2f}, P2 x={p2_initial_x:.2f}")
    
    # P1 pushes
    engine.handle_input("wrestler_A", "PUSH")
    
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
    P1 starts at x=22, P2 starts at x=42.
    After P2 pushes, P1's x should decrease.
    """
    engine = SumoEngine()
    
    # Set up wrestlers with known IDs
    p1_data = {"id": "wrestler_A", "name": "TestP1", "strength": 1.0}
    p2_data = {"id": "wrestler_B", "name": "TestP2", "strength": 1.0}
    engine.set_wrestlers(p1_data, p2_data)
    
    # Force into fighting state
    engine.state = STATE_FIGHTING
    
    # Record initial positions
    p1_initial_x = engine.p1['x']
    p2_initial_x = engine.p2['x']
    
    print(f"Initial: P1 x={p1_initial_x:.2f}, P2 x={p2_initial_x:.2f}")
    
    # P2 pushes
    engine.handle_input("wrestler_B", "PUSH")
    
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
    
    p2_initial_x = engine.p2['x']
    
    # Send ID as integer - should still work due to normalization
    engine.handle_input(123, "PUSH")  # int instead of str
    engine.tick(1/60.0)
    
    assert engine.p2['x'] > p2_initial_x, \
        f"ID normalization failed! P2 didn't move."
    
    print("✓ ID normalization (int vs string) - PASS")


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
    print("=" * 50)
    print("ALL TESTS PASSED ✓")
    print("=" * 50)
