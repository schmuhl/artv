# arTV
Pronounced "Art TV", this a very simple slideshow script designed to be run on a Raspberry Pi connected to a big screen TV, turning your TV into a rotating art piece.

- Place files in a web server directory on the Raspberry Pi
  - Requires PHP to get a listing of all the images
- Drop your favorite art and photos into the "art" directory.
 - Any files ending in "-snow" will automatically get a falling snow animation. (E.g. photo-snow.jpg)
- Connect Raspberry Pi to your TV
- Run a browser and open up the page (e.g. http://localhost/artv/)
- Enjoy!


## Installing on a Raspberry Pi
The following instructions "worked for me" but should be helpful in getting things going for you. Please make sure you understand what these commands are doing before you run them.

### Installing PHP and Apache
```bash
sudo apt update
sudo apt upgrade -y
sudo apt install apache2 -y
sudo apt install php libapache2-mod-php php-cli php-json php-mbstring php-curl -y
sudo systemctl restart apache2
```

### Deploying arTV
Set the appropriate permissions and clone the repository.
```bash
sudo usermod -a -G www-data pi
sudo chgrp -R www-data /var/www/html
sudo find /var/www/html -type f -exec chmod 664 {} \;
sudo find /var/www/html -type d -exec chmod 775 {} \;
cd /var/www/html
git clone https://github.com/schmuhl/artv.git # I had to log out and then log back in before I had the group access for this to work?
mkdir /var/www/html/artv/art
sudo chown -R pi:www-data /var/www/html/artv/art
```
Add the Google Drive API libraries.
```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
cd /var/www/html/artv
mkdir googleDrive
cd googleDrive
composer init
composer require google/apiclient:^2.0
```

### Add your images
The "art" folder holds all of the images that can be shown. Eligible images will be shown randomly for the configured duration based on the following options:
- Images in the "art" folder will be shown randomly. This is the simplest approach.
- Create folders for specific months: Images in these folders will only be shown randomly during those months. These folders look like "1" for January and "2" for February and so on.
- Create folders for specific days: Images in these folders will only be shown on that specific day and will be the only images that show on that day. An example for Christmas would look like "12-25".
- Images that end with "-snow" will automatically get a snow animation. For example "landscape-snow.jpg".


### Start arTV on reboot
Next we'll create a service that will run every time the computer reboots. Open up this new file and paste in the following.
```bash
sudo pico /etc/systemd/system/artv.service
```

```bash
[Unit]
Description=arTV
After=graphical.target
Requires=graphical.target

[Service]
User=pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
ExecStart=/usr/bin/chromium-browser --kiosk http://localhost/artv
Restart=on-failure
RestartSec=10

[Install]
WantedBy=graphical.target
```

Enable the service and get it started. You should see it in the status.
```bash
sudo systemctl enable artv.service
sudo systemctl start artv.service
sudo systemctl status artv.service
```


### Ensure that the screen stays on
Make sure that the screen never blanks so it's always on, burning into the retinas of your viewers! We'll kick this off, but you'll need to use the UI to complete it.
```bash
sudo raspi-config
```
1. Navigate to Display Options.
2. Look for an option related to Screen Blanking or Screen Saver.
3. Select this option and choose No or Disable.
4. Select Finish and you might be prompted to reboot.


### Make a samba share
With a file share into the art folder, it's easier to manage the photos that are shown. This is a security vulnerability, so please consider this hack carefully. It makes it easy, but it may not be appropriate.

```bash
sudo apt install samba samba-common-bin -y
sudo pico /etc/samba/smb.conf
```

Paste the following settings at the end of the file. Save and exit.
```bash
[arTV]
comment = arTV images
path = /var/www/html/artv/art
browseable = yes
writable = yes
guest ok = no
read only = no
create mask = 0775
directory mask = 0775
force user = pi
force group = www-data
```

Set the password for the "pi" samba user. This can be the same as the password for system, but see the security warning above.
```bash
sudo smbpasswd -a pi
sudo systemctl restart smbd
```

### Configuration
You can change some of the configuration with a simple JSON file located at "art/config.json". Here is an example of the available settings:
```bash
{
  "debug" : false,
  "showClock" : true,
  "rotationSpeed" : 5,
  "imageFit" : "contain",
  "GoogleDrive" : {
    "enabled" : true,
    "serviceAccountFile" : "PATH TO FILE",
    "folderID" : "GOOGLE DRIVE FOLDER ID FROM URL"
  }
}
```
Note that rotation speed is in minutes and that the image fit setting can be either "contain" which will show the whole image, or "cover" which will zoom in on the image to ensure it covers the whole screen.
Additionally, you can press "p" to toggle a preview of the next image, "d" to toggle debug, "f" to toggle the image fit, and "c" to toggle the clock manually.

### Enjoy!


## Instructions for managing the photos
1. Open \\192.168.1.175\html by either typing it in after clicking on the Windows start button, or by typing that in one of your file explorer windows.

2. You'll be prompted for a username (pi) and password (raspberry)

3. If that opens, you should see some files. Navigate to the "artv" and then the "art" folder. Inside that "art" folder should be several images. These are the images that are being served up to the monitors, in random order. Feel free to experiment with new, fewer, or different images in there.

4. You can test it on your own computer by opening a web browser to http://192.168.1.175 clicking anywhere on the image will advance it to the next one. Again, it's random but it should allow you to test out new images before the monitors eventually get to the new images.

OK, maybe that's a lot. Feel free to call me and I can help you out.
