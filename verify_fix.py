
# Verification Script for Matt vs Matt Fix
p1_id = 10
p2_id = 20
rows = [
    {'id': 10, 'name': 'Matt'},
    {'id': 20, 'name': 'Bea'}
]

print(f"Scenario 1: rows = [P1, P2]")
# Function from FIXED code
w1 = next(r for r in rows if r['id'] == int(p1_id))
w2 = next(r for r in rows if r['id'] == int(p2_id))

print(f"w1: {w1['name']} (ID: {w1['id']})")
print(f"w2: {w2['name']} (ID: {w2['id']})")

if w1['id'] != w2['id'] and w1['id'] == 10 and w2['id'] == 20:
    print("PASS: Wrestlers are different and correct.")
else:
    print("FAIL: Logic incorrect.")

print("-" * 20)

print(f"Scenario 2: rows = [P2, P1]")
rows_reversed = [rows[1], rows[0]]
w1_r = next(r for r in rows_reversed if r['id'] == int(p1_id))
w2_r = next(r for r in rows_reversed if r['id'] == int(p2_id))

print(f"w1: {w1_r['name']} (ID: {w1_r['id']})")
print(f"w2: {w2_r['name']} (ID: {w2_r['id']})")

if w1_r['id'] != w2_r['id'] and w1_r['id'] == 10 and w2_r['id'] == 20:
    print("PASS: Wrestlers are different and correct.")
else:
    print("FAIL: Logic incorrect.")
