"""Compatibility entrypoint: generate the current redesigned Thorium armor icons."""
from pathlib import Path
import importlib.util
import sys
if __name__=='__main__':
    path=Path(__file__).with_name('generate-thorium-family.py')
    spec=importlib.util.spec_from_file_location('thorium_family',path)
    family=importlib.util.module_from_spec(spec);spec.loader.exec_module(family)
    raise SystemExit(family.main(['--only','armor',*sys.argv[1:]]))
