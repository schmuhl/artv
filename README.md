# arTV
"Art TV" is a very simple slideshow script designed to be run on a Raspberry Pi connected to a big screen TV, turning your TV into a rotating art piece.

- Place files in a web server directory on the Raspberry Pi
  - Requires PHP to get a listing of all the images
- Drop your favorite art and photos into the "art" directory.
 - Any files ending in "-snow" will automatically get a falling snow animation. (E.g. photo-snow.jpg)
- Connect Raspberry Pi to your TV
- Run a browser and open up the page (e.g. http://localhost/artv/)
  - I've done this on my Raspberry Pi by adding the following to /etc/xdg/lxsession/LXDE-pi/autostart : @chromium-browser --start-fullscreen http://localhost/artv/ 
- Set the browser to full screen
- Enjoy!
