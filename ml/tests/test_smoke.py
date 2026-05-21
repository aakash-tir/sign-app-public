"""Smoke tests proving the package imports and the toolchain runs (M0)."""

from sign_ml import __version__, package_name


def test_package_name() -> None:
    assert package_name() == "sign-ml"


def test_version() -> None:
    assert __version__ == "0.0.0"
