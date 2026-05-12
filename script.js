var screenid, rotationSpeed = 60, rotationInterval, imageFit = 'contain', debug = false;
var showClock = false, blanking = false, clockInterval;


// Wait for the DOM to be ready before starting
document.addEventListener('DOMContentLoaded', () => {
    startApp();
});


async function startApp() {
    await loadConfiguration();

    const paneOne = document.getElementById('one');
    const splashImg = paneOne.querySelector('img');
    const clock = document.getElementById('clock');

    // Initial Splash
    paneOne.classList.add('active');

    setTimeout(() => {
      rotate();
      rotationInterval = setInterval(rotate, rotationSpeed * 60 * 1000);

      if (showClock) {
        clock.style.display = 'block';
        clock.style.opacity = '0';
        setTimeout(() => clock.style.opacity = '1', 100);
        clockUpdate();
        clockInterval = setInterval(clockUpdate, 20000);
      }
    }, 4000);

    // Click to rotate
    document.addEventListener('click', () => rotate());

    // Hotkeys (Simplified Native version)
    document.addEventListener('keyup', (e) => {
      const panes = document.querySelectorAll('.pane');
      if (e.key === 'd') {
        debug = !debug;
        console.log("Toggling debug to "+debug);
        panes.forEach(p => p.classList.toggle('debug', debug));
      } else if (e.key === 'c') {
        const isVisible = clock.style.display !== 'none';
        clock.style.display = isVisible ? 'none' : 'block';
        console.log("Toggling clock to "+!isVisible);
      } else if (e.key === 'f') {
        imageFit = (imageFit === 'cover') ? 'contain' : 'cover';
        document.querySelectorAll('.pane img').forEach(img => {
            img.className = imageFit;
        });
        console.log("Toggling image fit to "+imageFit);
      }
    });
}


async function loadConfiguration() {
  var path = 'art/config.json';
  const urlParams = new URLSearchParams(window.location.search);
  screenid = urlParams.get('screen');
  const screenKey = "screen" + screenid;

  try {
    const response = await fetch(path);
    if (!response.ok) return; // Use defaults if file missing

    let data = await response.json();

    // look for configuration overrides for this screen
    if ( screenid && data[screenKey]) {
      console.log(`Applying configuration for screen ${screenid}`);
      data = { ...data, ...data[screenKey] };
    }

    // Map data to global variables
    if (data.debug !== undefined) debug = data.debug;
    if (data.showClock !== undefined) showClock = data.showClock;
    if (data.rotationSpeed !== undefined) rotationSpeed = data.rotationSpeed;
    if (data.imageFit !== undefined) imageFit = data.imageFit;
    if (data.blanking !== undefined) blanking = data.blanking;

    // Process blanking times if they exist
    if (blanking && blanking.start && blanking.end) {
      blanking.start = stringToTime(blanking.start);
      blanking.end = stringToTime(blanking.end);
      if (blanking.start > blanking.end) {
        blanking.end.setDate(blanking.end.getDate() + 1);
      }
    }

    console.log("Configuration successfully loaded.");
  } catch (e) {
    console.warn("Using default config due to error:", e);
  }
}


async function rotate() {
    // 1. Find the active pane, with a fallback to 'one' if none is active yet
    let offPane = document.querySelector('.pane.active');

    // If somehow no pane is active, default to #one so the script doesn't crash
    if (!offPane) {
        offPane = document.getElementById('one');
    }

    const onPane = document.getElementById(offPane.id === 'one' ? 'two' : 'one');

    const mediaUrl = `api.php?screen=${screenid}&cb=${Date.now()}`;

    try {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const contentType = response.headers.get('Content-Type');
        const blobUrl = URL.createObjectURL(blob);

        if (contentType.startsWith('image/')) {
            onPane.innerHTML = `<img class="${imageFit}" src="${blobUrl}">`;
            onPane.querySelector('img').onload = () => performSwap(onPane, offPane);
        } else if (contentType.startsWith('video/')) {
            onPane.innerHTML = `<video muted loop src="${blobUrl}"></video>`;
            const video = onPane.querySelector('video');
            video.onloadeddata = () => {
                video.play();
                performSwap(onPane, offPane);
            };
        }
    } catch (err) {
        console.error("Rotate failed", err);
    }
}

function performSwap(on, off) {
    // Make sure new pane starts visible to the browser
    on.style.visibility = 'visible';

    // Trigger crossfade immediately
    on.classList.add('active');
    off.classList.remove('active');

    // Cleanup old pane after fade completes
    setTimeout(() => {
        if (!off.classList.contains('active')) {
            off.innerHTML = '';
        }
    }, 2200);
}


function stringToTime ( string ) {
  var timeRegex = /^(\d{1,2}):(\d{2})\s?(am|pm)$/i;
  var match = timeRegex.exec(string.trim());
  if (match) {
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    var ampm = match[3].toLowerCase();
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      console.warn(`Time string "${string}" has invalid hour or minute values: .`);
      return null;
    }
  } else {
    console.warn(`Time string "${string}" is not in the expected "h:mm am/pm" format.`);
    return null;
  }
  // Adjust hours for 24-hour format
  if (ampm === 'pm' && hours !== 12) {
    hours += 12;
  } else if (ampm === 'am' && hours === 12) {
    hours = 0;
  }
  var givenTime = new Date();
  givenTime.setHours(hours, minutes, 0, 0);
  return givenTime;
}


function clockUpdate() {
    const now = new Date();
    const clock = document.getElementById('clock');

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    clock.innerHTML = `${hours}:${minutes}<span class="ampm">${ampm}</span>`;

    if (blanking && now >= blanking.start && now < blanking.end) {
        window.location.reload();
    }
}


async function fileExists(filename) {
  try {
    const response = await fetch(filename, { method: 'HEAD' });
    return response.ok; // Returns true if status is 200-299
  } catch (error) {
    return false; // Network error or file doesn't exist
  }
}
