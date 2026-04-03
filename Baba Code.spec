# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['baba_desktop.py'],
    pathex=[],
    binaries=[],
    datas=[('src', 'src'), ('reference_data', 'reference_data')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Baba Code',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='C:\\Users\\Silva\\AppData\\Local\\Temp\\878e2f1e-0282-4c6e-b75f-d036bf427d77',
)
