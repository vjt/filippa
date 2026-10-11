"""Import the cycle logic as a top-level package: the integration package
itself needs Home Assistant, the logic does not."""
import sys
from pathlib import Path

# Appended, not prepended: the integration's own modules (sensor.py, ...) must
# not shadow anything of the standard library.
sys.path.append(str(Path(__file__).parent.parent / "custom_components" / "filippa"))
