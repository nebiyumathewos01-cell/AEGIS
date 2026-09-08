#!/usr/bin/env bash
set -e
pip install --upgrade pip
pip install -r requirements.txt --only-binary=:all: || pip install -r requirements.txt
