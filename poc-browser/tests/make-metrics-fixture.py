"""Pad a copy of the canonical seed using an existing company description."""
import shutil
import sqlite3
import sys
from pathlib import Path
source, target, mib = sys.argv[1], sys.argv[2], int(sys.argv[3])
shutil.copyfile(source, target)
with sqlite3.connect(target) as database:
    database.execute('UPDATE companies SET description=? WHERE id=(SELECT MIN(id) FROM companies)', ('x' * (mib * 1024 * 1024),))
    database.commit()
    database.execute('VACUUM')
print(Path(target).stat().st_size)
