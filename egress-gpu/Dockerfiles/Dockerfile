FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=all

RUN apt-get update && apt-get install -y build-essential && apt-get -f install -y

# Install necessary dependencies
RUN apt-get update && apt-get install -y \
	wget \
	xvfb \
	&& apt-get -f install -y

# Add Google Chrome repository
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Install Google Chrome
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    && apt-get -f install -y \
    && rm -rf /var/lib/apt/lists/*

# Set up environment variables
ENV DISPLAY=:99
ENV __NV_PRIME_RENDER_OFFLOAD=1
ENV __GLX_VENDOR_LIBRARY_NAME=nvidia

# Create a startup script for Xvfb
RUN echo '#!/bin/bash\n\
Xvfb :99 -ac +extension RANDR +extension GLX &\n\
XVFB_PID=$!\n\
until xdpyinfo -display :99 > /dev/null 2>&1; do\n\
    echo "Waiting for Xvfb..."\n\
    sleep 0.1\n\
done\n\
echo "Xvfb is running."\n\
echo "OpenGL vendor string: $(DISPLAY=:99 glxinfo | grep "OpenGL vendor")" \n\
echo "OpenGL renderer string: $(DISPLAY=:99 glxinfo | grep "OpenGL renderer")" \n\
echo "CUDA version: $(nvcc --version | grep "release" | awk "{print \$5}" || echo "NVCC not found")" \n\
echo "You can now run Google Chrome."\n\
echo "OpenGL vendor string: $(DISPLAY=:99 glxinfo | grep "OpenGL vendor")"\n\
echo "OpenGL renderer string: $(DISPLAY=:99 glxinfo | grep "OpenGL renderer")"\n\
echo "$(ldconfig -p | grep libEGL)"\n\
echo "$(ls -l /usr/lib/x86_64-linux-gnu/libEGL*)"\n\
exec "$@"' > /usr/local/bin/start-xvfb.sh \
	&& chmod +x /usr/local/bin/start-xvfb.sh

# Set the entrypoint to our Xvfb startup script
ENTRYPOINT ["/usr/local/bin/start-xvfb.sh"]

# Default command (can be overridden)
CMD ["bash"]