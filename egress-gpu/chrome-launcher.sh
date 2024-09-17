#!/bin/bash
set -e

# Start Xvfb
Xvfb :99 -ac &
export DISPLAY=:99

# Run Chrome with the specified options
google-chrome-stable \
    --headless \
    --no-sandbox \
    --ignore-gpu-blocklist \
    --use-gl=angle \
    --use-angle=gl-egl \
    --use-cmd-decoder=passthrough \
    --remote-debugging-port=0.0.0.0:9222 \
    'https://webglreport.com/'