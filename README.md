# What is this?
This is a Project64 script to enable Multiworld support for Ocarina of Time Randomizer.
This is a client script that connects to a supporting server. A public server is available and is configured as the default.

# Why?
Project64 is quite a bit more performant than Bizhawk and with less visual glitches (light from torches aren't visible through walls for example).
It also crashes less.

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

The default server is most likely what you want.
When it asks for a room, use the seed from the randomizer. If for some reason that fails, any string of letters should work.
**Every player of the same Multiworld session needs to use the same room name!**

**Note:** The script will not attempt to make any connections until the ROM is loaded.
