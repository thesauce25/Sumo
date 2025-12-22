import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from main import app
    print("SUCCESS: App imported.")
except Exception as e:
    print(f"FAILURE: {e}")
    import traceback
    traceback.print_exc()
