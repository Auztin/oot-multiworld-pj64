# What is this?
This is a Project64 script to enable Multiworld support for Ocarina of Time Randomizer.
It attempts to use the same network protocol as the bizhawk-coop script, and should therefore be compatible with Bizhawk clients running the bizhawk-coop script. Although developement was tested with Bizhawk clients, a full run has not been tested with Bizhawk clients.
This only supports direct connections.

# Why?
The original motivation was to learn how multiworld worked exactly, so that I could one day make Multiworld work on real hardware. Unfortunately I do not own a 64drive at this time as orders are currently closed.
Also, Project64 is quite a bit more performant than Bizhawk and with less visual glitches (light from torches aren't visible through walls for example).

# Support
If you find this useful, consider supporting me on [Patreon](https://www.patreon.com/Austin0)

# Setup
### You will need a nightly build of Project64. This was developed using version Dev-4.0.0.5713-ce6042f although later versions **should** work.
1. In Project64, go to Options->Configuration
2. Under General settings, uncheck Hide advanced settings
3. Under General settings->Advanced, check the following:
   - Enable debugger
   - Always use interpreter core
4. Click OK
5. Go to Debugger->Scripts...
6. Click on the ... button on the bottom left. This will open the Scripts folder that Project64 is looking in.
7. Place the Multiworld.js file here.

### Running the script
1. In Project64, go to Debugger->Scripts...
2. Select Multiworld.js
3. Click Run
4. Type answers to questions in the box at the bottom.

If you are hosting, you will need to ensure that the port you give the script is accesible from the clients that need to connect. This means port forwarding in most environments.

If you are connecting, you will need the IP or hostname and port from the Host.

**Note:** The script will not attempt to make any connections until the ROM is loaded.

There is an auto-reconnect feature. If the connection to the host is broken for some reason, the script will attempt to reconnect every 5 seconds until a connection is established. Unfortunately, Project64 has a failed connection timeout of 20 seconds that I can't adjust. This will make it appear that Project64 is crashing for the duration of the 20 seconds if you try to close it or stop the script while it's attempting to connect.
