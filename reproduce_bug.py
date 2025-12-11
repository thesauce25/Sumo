
# Reproduction Script for Matt vs Matt Bug
p1_id = 10
p2_id = 20

# Mock Rows from DB (id, name)
rows = [
    {'id': 10, 'name': 'Matt'},
    {'id': 20, 'name': 'Bea'}
]

print(f"Scenario 1: rows = [P1, P2]")
# Function from current code
w1 = rows[0] if rows[0]['id'] == int(p1_id) else rows[1]
w2 = rows[1] if rows[1]['id'] == int(p1_id) else rows[0]

print(f"p1_id: {p1_id}, p2_id: {p2_id}")
print(f"w1: {w1['name']} (ID: {w1['id']})")
print(f"w2: {w2['name']} (ID: {w2['id']})")

if w1['id'] == w2['id']:
    print("FAIL: Both wrestlers are the same!")
else:
    print("PASS: Wrestlers are different.")

print("-" * 20)

print(f"Scenario 2: rows = [P2, P1]")
rows_reversed = [rows[1], rows[0]]
w1_r = rows_reversed[0] if rows_reversed[0]['id'] == int(p1_id) else rows_reversed[1]
w2_r = rows_reversed[1] if rows_reversed[1]['id'] == int(p1_id) else rows_reversed[0]

print(f"w1: {w1_r['name']} (ID: {w1_r['id']})")
print(f"w2: {w2_r['name']} (ID: {w2_r['id']})")

if w1_r['id'] == w2_r['id']:
    print("FAIL: Both wrestlers are the same!")
else:
    print("PASS: Wrestlers are different.")
