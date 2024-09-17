# GPU Instance Setup for EC2

## Building GPU Enabled Egress Container

- Make the necessary changes and run the docker build command to create the GPU-enabled Egress container.
``` bash
	docker buildx build --no-cache --platform linux/amd64 -t quitalizner/egress-gpu:v{VERSION_NUMBER} --push -f build/egress/Dockerfile .
```
- Pushing the container to Docker Hub.
``` bash
	docker push quitalizner/egress-gpu:v1
```

- In case your docker is running out of space
``` bash
	docker system prune -a
```

## g4dn-xlarge Instance Type Setup

We need to have a minimum of 4 CPU cores and a minimum of 16gb storage for the drivers to be installed.
We are using the Ubuntu 22.04 AMI for this setup.

### Install NVIDIA Drivers

Resources:
- [Ubuntu + EC2 g4dn.xlarge](https://dev.to/mirzabilal/how-to-enable-hardware-acceleration-on-chrome-chromium-puppeteer-on-aws-in-headless-mode-50hd)

``` bash
	sudo bash -c "apt update && export DEBIAN_FRONTEND=noninteractive && export NEEDRESTART_MODE=a && apt upgrade -y && reboot"

	# build-essential is a set of compilation tools required to compile the Nvidia driver.
	# libvulkan1 is required by Google Chrome to use the GPU for hardware acceleration.
	# NOTE: In order to avoid the following warning when installing nvidia driver on ubuntu. WARNING: nvidia-installer was forced to guess the X library path '/usr/lib' and X module path '/usr/lib/xorg/modules'; these paths were not queryable from the system.  If X fails to find the NVIDIA X driver module, please install the pkg-config utility and the X.Org SDK/development package for your distribution and reinstall the driver.
	# Install the libvulkan1, xserver-xorg-core, xorg-dev, pkg-config, libglvnd-dev utility before installing nvidia driver.
	sudo apt install -y build-essential libvulkan1 pkg-config xorg-dev libglvnd-dev xserver-xorg-core linux-headers-$(uname -r)

	sudo apt -f install -y
```

To check latest version of Nvidia driver available for the current distriubtion, run the following command:

``` bash
	# ubuntu-drivers tool to identify the recommeended drivers
	sudo apt install -y ubuntu-drivers-common
	
	# (Optional) List the available Nvidia drivers
	ubuntu-drivers devices
	# (Either) Install the a Nvidia driver of your choice from the aviablable list from previous step. 	# (OR) Install the recommended driver automatically `sudo ubuntu-drivers autoinstall`
	sudo apt install -y nvidia-driver-xxx
	# Reboot NOW
	sudo reboot
	# NOTE: running nvidia-smi once is needed for the proper initialization of EGL and ANGLE. Google Chrome and Chromium fail to initialize EGL without this preliminary setup.
	# nvidia-smi should be run everytime the Instance reboots. To automate this, add the following lines
	echo '[Unit]
	Description=Run nvidia-smi at system startup

	[Service]
	ExecStart=/usr/bin/nvidia-smi
	Type=oneshot
	RemainAfterExit=yes

	[Install]
	WantedBy=multi-user.target' | sudo tee /etc/systemd/system/nvidia-smi.service
	sudo systemctl enable nvidia-smi.service
	sudo systemctl start nvidia-smi.service
	# Check the Nvidia driver version. IMPORTANT to run this atleast once after reboot
	nvidia-smi
	# CUDA & Vulkan	
	sudo apt install -y vulkan-tools nvidia-cuda-toolkit x11-xserver-utils
	# Reboot NOW
	sudo reboot
	# Check the CUDA version
	nvcc --version
	# Check Vulkan Version
	vulkaninfo --summary

	# Check if the X server is running, which might be necessary for GPU acceleration: 
	ps aux | grep X
```

### Test the WEBGL using a headless chrome script

``` bash
	# Install Google Chrome
	curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/googlechrom-keyring.gpg
	echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrom-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
	sudo apt update
	sudo apt install -y google-chrome-stable

	# Start dbus to avoid warnings by Chrome later.
	export DBUS_SESSION_BUS_ADDRESS="unix:path=/var/run/dbus/system_bus_socket"
	sudo /etc/init.d/dbus start

	# (EITHER) Test the WEBGL using a headless chrome script
	google-chrome-stable --headless --use-gl=angle --use-angle=gl-egl --use-cmd-decoder=passthrough --print-to-pdf=output.pdf --allow-chrome-scheme-url 'chrome://gpu'

	# OR 
	# Use Puppeteer to test WEBGL and get performance
	# Install Node.js and npm
	curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
	NODE_MAJOR=18
	echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
	sudo apt update
	sudo apt install nodejs

	# Create a new directory for the project
	mkdir webgl-test
	cd webgl-test

	# Initialize a new Node.js project and install puppeteer
	npm init -y
	npm install puppeteer

	# Create a new JavaScript file for the WebGL test script
	nano nvidia-webgl-test.js

	# Copy the nvdia-webgl-test.js script to the project directory
	# You can find the script in the egress-gpu folder of this repository
	# Save and exit the editor
	# Ctrl + O, Enter, Ctrl + X

	# Run the script
	node nvidia-webgl-test.js

	# If the script runs successfully, you should see the following output
	# WebGL Information: {
	# supported: true,
	# renderer: 'ANGLE (NVIDIA Corporation, Tesla T4/PCIe/SSE2, OpenGL ES 3.2)',
	# performanceScore: 7142.857140956485,
	# extensions: [
	# 	'ANGLE_instanced_arrays',
	# 	'EXT_blend_minmax',
	# 	'EXT_clip_control',
	# 	'EXT_color_buffer_half_float',
	# 	...
	

	# NOTE: Also an output.png image is generated of the chrome://gpu page of the headless chrome. You can copy that image to your local system by running the following command from the terminal of your local system
	scp -i "vc-demo-server.pem" ubuntu@ec2-44-200-176-65.compute-1.amazonaws.com:~/output.png ~/Documents/
```

### Test the Headless Chrome with Remote debugging

``` bash
	# Test the Headless Chrome with Remote debugging. Run this on the EC2 instance
	google-chrome-stable --headless --use-gl=angle --use-angle=gl-egl --use-cmd-decoder=passthrough --remote-debugging-port=9222 'https://webglreport.com/'

	# OR
	google-chrome-stable --headless --use-angle=vulkan --use-cmd-decoder=passthrough --remote-debugging-port=9222 'https://webglreport.com/'

	# On your local system
	# Open a new terminal and run the following command. # This will forward the remote debugging port 9222 to your local system
	ssh -i "vc-demo-server.pem" -L 9222:localhost:9222 ubuntu@ec2-44-200-176-65.compute-1.amazonaws.com
	
	# Open Chrome browser and go to chrome://inspect
	# Click on Configure...
	# Select localhost:9222
	# Click on Inspect on the link that shows in the Remote Target section
---

git clone livekit-deploy-files
cd ./egress-local-test
chmod +x init_script.sh
sudo ./init_script.sh

## Common Issues

- If you encounter exec error on entrypoint.sh when checking the logs using docker-compose logs of the livekit-docker service, it's likely due to docker build using an incompatible platform. Example arm64 build for a x86 64-bit instance and vice versa.

# Install Nvidia Container Toolkit and 

``` bash
	# Add the NVIDIA repository
	curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
	&& curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
		sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
		sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

	# Install the toolkit
	sudo apt update
	sudo apt install -y nvidia-container-toolkit

	# Edit the Docker daemon configuration file:
	sudo nvidia-ctk runtime configure --runtime=docker

	# Restart Docker to apply the changes:
	sudo systemctl restart docker

	# Verify that the NVIDIA Container Toolkit is installed correctly:
	sudo docker run --rm --gpus all ubuntu nvidia-smi
	# If successful, this should display information about your GPU.
```

sudo docker exec <container_id_or_name> nvidia-smi
sudo docker run --rm ubuntu nvidia-smi

sudo docker run --gpus all -p 127.0.0.1:9222:9222 --privileged quitalizner/headless:v3

sudo docker run --gpus all -p 0.0.0.0:9222:9222 --privileged quitalizner/headless:v4

docker buildx build --no-cache --platform linux/amd64 -t quitalizner/headless:v6 --push -f ./Dockerfile .

 
 --enable-features=Vulkan --disable-vulkan-surface --use-angle=vulkan 
--ignore-gpu-blocklist --disable-software-rasterizer

google-chrome-stable --headless=new --use-cmd-decoder=passthrough --ignore-gpu-blocklist --use-gl=angle --no-sandbox --use-angle=gl-egl  --remote-debugging-port=9222 'https://webglreport.com/'

google-chrome-stable --headless --ignore-gpu-blocklist --use-gl=angle --use-cmd-decoder=passthrough --use-angle=gl-egl --remote-debugging-port=9222 'https://webglreport.com/'

sudo docker exec 2e52ce446a72 google-chrome-stable --headless --no-sandbox --ignore-gpu-blocklist --use-gl=angle --use-angle=vulkan --use-cmd-decoder=passthrough --enable-gpu-rasterization --enable-zero-copy --remote-debugging-port=9222 --allow-insecure-localhost 'https://webglreport.com/'

First, to find out which process is using the port:
sudo lsof -i :9222

sudo kill -9 <PID>

google-chrome --version

sudo docker exec aba5349111ed google-chrome-stable --headless --no-sandbox --enable-features="Vulkan,UseSkiaRenderer" --disable-vulkan-surface  --use-cmd-decoder=passthrough --enable-gpu-rasterization --enable-zero-copy --use-angle=vulkan --remote-debugging-port=9222 --enable-logging=stderr --v=3 'https://webglreport.com/'

sudo docker build -t chrome-vulkan .
sudo docker run --rm --runtime=nvidia --network host -it --gpus all --privileged --cap-add=SYS_ADMIN chrome-vulkan:latest

	sudo docker run --gpus all -it --rm \
	--privileged \
	--cap-add=SYS_ADMIN \
	-e DISPLAY=:99 \
  -e NVIDIA_VISIBLE_DEVICES=all \
  -e NVIDIA_DRIVER_CAPABILITIES=all \
  chrome-image:latest

google-chrome-stable --headless --use-gl=angle --use-angle=gl-egl --use-cmd-decoder=passthrough --remote-debugging-port=9222  --no-sandbox --enable-logging=stderr --v=1 'https://webglreport.com/'

google-chrome-stable --headless --use-gl=angle --use-angle=gl-egl --use-cmd-decoder=passthrough --remote-debugging-port=9222  --no-sandbox 'https://webglreport.com/'


// 


# Exposing Nvidia Drivers to Docker Container without having to reinstall them (NOTE: This works with ultraminimal docker and enables both gl-egl and vulkan)
I understand you want to reuse the NVIDIA drivers already installed on the host without reinstalling them in the container. This is indeed possible and is actually the recommended approach when using NVIDIA GPUs with Docker. Here's how you can modify your setup to achieve this:

Keep your current Dockerfile as is, using Ubuntu as the base image.
When running the container, you'll need to use the --gpus all flag along with some volume mounts to share the necessary NVIDIA libraries and drivers. Here's the modified run command:

sudo docker run --rm --runtime=nvidia --network host --gpus all \
	--privileged --cap-add=SYS_ADMIN \
	--shm-size=2g \
	-v /usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu \
	-v /usr/bin/nvidia-smi:/usr/bin/nvidia-smi \
	-v /usr/lib/nvidia:/usr/lib/nvidia \
	-v /sys/devices/system/cpu:/sys/devices/system/cpu:ro \
	--device /dev/nvidia0:/dev/nvidia0 \
	--device /dev/nvidiactl:/dev/nvidiactl \
	--device /dev/nvidia-uvm:/dev/nvidia-uvm \
	-it chrome-vulkan:latest

sudo docker run --rm --runtime=nvidia --network host --gpus all \
	--privileged --cap-add=SYS_ADMIN \
	--shm-size=2g \
	-v /usr/lib/x86_64-linux-gnu/libEGL_nvidia.so.0:/usr/lib/x86_64-linux-gnu/libEGL_nvidia.so.0 \
	-v /usr/lib/x86_64-linux-gnu/libEGL_mesa.so.0:/usr/lib/x86_64-linux-gnu/libEGL_mesa.so.0 \
	-v /usr/lib/x86_64-linux-gnu/libEGL.so.1:/usr/lib/x86_64-linux-gnu/libEGL.so.1 \
	-v /usr/lib/x86_64-linux-gnu/libEGL.so:/usr/lib/x86_64-linux-gnu/libEGL.so \
	-v /usr/bin/nvidia-smi:/usr/bin/nvidia-smi \
	-v /usr/lib/nvidia:/usr/lib/nvidia \
	-v /sys/devices/system/cpu:/sys/devices/system/cpu:ro \
	--device /dev/nvidia0:/dev/nvidia0 \
	--device /dev/nvidiactl:/dev/nvidiactl \
	--device /dev/nvidia-uvm:/dev/nvidia-uvm \
	-it chrome-vulkan:latest

These flags can be added to docker to limit
	--memory=8g --memory-swap=16g \
	--cpus=4 \

Let's break down what these flags do:
--runtime=nvidia: Very important to expose GPU resources to the container.
--gpus all: This tells Docker to make all GPUs available to the container.
-v /usr/lib/x86_64-linux-gnu:/usr/lib/x86_64-linux-gnu: This mounts the host's library directory into the container, giving access to NVIDIA libraries.
-v /usr/bin/nvidia-smi:/usr/bin/nvidia-smi: This gives the container access to the nvidia-smi tool.
-v /usr/lib/nvidia:/usr/lib/nvidia: This mounts additional NVIDIA libraries.
--device /dev/nvidia*: These flags give the container direct access to the GPU devices.
--shm-size=2g: This increases the shared memory size to 2GB, which can be necessary is there's a lot of data being handled or downloaded by the container. Has been added here to fix the ERR_INSUFFICIENT_RESOURCES noticed in some of the games during loading, which was leading to crash

You might need to adjust these paths if your NVIDIA libraries are installed in different locations on your host system.

In your Dockerfile, you can remove any NVIDIA-specific installations or configurations, as these will now come from the host.

This setup should allow your Docker container to use the NVIDIA drivers and libraries from the host system without needing to reinstall them in the container.

google-chrome-stable --headless --use-gl=angle --use-angle=gl-egl --use-cmd-decoder=passthrough --disable-gpu-vsync --enable-gpu-rasterization --enable-zero-copy --remote-debugging-port=9222  --no-sandbox 'https://webglreport.com/'

ldconfig -p | grep libEGL
libEGL_nvidia.so.0 (libc6,x86-64) => /lib/x86_64-linux-gnu/libEGL_nvidia.so.0
libEGL_mesa.so.0 (libc6,x86-64) => /lib/x86_64-linux-gnu/libEGL_mesa.so.0
libEGL.so.1 (libc6,x86-64) => /lib/x86_64-linux-gnu/libEGL.so.1
libEGL.so (libc6,x86-64) => /lib/x86_64-linux-gnu/libEGL.so

ls /dev/nvidia*
/dev/nvidia-modeset  /dev/nvidia-uvm  /dev/nvidia-uvm-tools  /dev/nvidia0  /dev/nvidiactl

/dev/nvidia0: Typically needed. This represents the actual GPU device.
/dev/nvidiactl: Usually required. It's the NVIDIA management device.
/dev/nvidia-uvm: Often needed for CUDA applications. It's used for unified memory management.
/dev/nvidia-uvm-tools: Less commonly required. It's used for profiling and debugging CUDA applications.
/dev/nvidia-modeset: Rarely needed in Docker containers. It's more relevant for display and graphics-related operations.