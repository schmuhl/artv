<?php
// load the configuration file, if available
$configFile = 'art/config.json';
$config = null;
if ( file_exists($configFile) ) {
  $json = file_get_contents($configFile);
  if ( $json !== false ) {
    $config = json_decode($json);
    if ( json_last_error() !== JSON_ERROR_NONE ) {
      error_log("Configuration file is not valid JSON: $configFile ".json_last_error_msg());
    }
  } else {
    error_log("Failed to read config file: $configFile");
  }
  // process values
  //print_r($config);
  //$debug = $config->debug;
  $debug = ( isset($_GET['debug']) ) ? true : false;
  $cache = '/tmp/artv-cache';
  $cacheLength = 30;  // in seconds

  // set the timezone
  if (isset($config->timezone) && !empty($config->timezone)) {
    try {
        date_default_timezone_set($config->timezone);
    } catch (Exception $e) {
      //echo "Error setting timezone from config file. Using server's default.<br>";
      date_default_timezone_set(date_default_timezone_get());
    }
  } else {
      //echo "No 'timezone' specified in config.json. Using server's default.<br>";
      date_default_timezone_set(date_default_timezone_get());
  }
}


/* pull from the cache, if recent
if ( file_exists($cache) ) {
  if ( time()-filemtime($cache) <= $cacheLength ) {
    if ( $debug ) echo "Using cached file. ";
    else outputFile($cache);
  } else {
    if ( $debug ) echo "Not using cached file. ";
  }
} else {
  if ( $debug ) echo "There is no cached file. ";
}
*/


// ------------------------------ PULL FROM GOOGLE DRIVE
if ( isset($config->GoogleDrive) && isset($config->GoogleDrive->enabled) && $config->GoogleDrive->enabled ) {
  require __DIR__ . '/googleDrive/vendor/autoload.php';

  // Ensure the service file exists
  if ( isset($config->GoogleDrive->serviceAccountFile) && is_file($config->GoogleDrive->serviceAccountFile) ) {
    $client = new Google_Client();
    $client->setApplicationName('Drive Downloader');
    $client->setAuthConfig($config->GoogleDrive->serviceAccountFile);
    $client->addScope(Google_Service_Drive::DRIVE_READONLY);
    $service = new Google_Service_Drive($client);
    try {
      $results = $service->files->listFiles([
          'q' => "'".$config->GoogleDrive->folderID."' in parents and ( mimeType contains 'image/' or mimeType contains 'video/' )", // Filter for images and videos
          'fields' => 'files(id, name, mimeType)',
      ]);
      $files = $results->getFiles();
      if ( $debug ) {  // show the list of eligible files instead
        header("HTTP/1.1 200 OK");
        header('Content-type: text/json');
        echo json_encode(array_values($files)); // Encode the file listing as JSON
        exit();
      }

      if ( count($files) > 0 ) {  // if we have more than one file
        //print_r($files); print_r(count($files)); die();
        $file = $files[rand(0,count($files)-1)];
        //print_r($file); die();
        $fileId = $file->id; //access id as an object property.
        $name = $file->getName();
        $mimeType = $file->getMimeType();

        /*
        try {
          $response = $service->files->get($fileId, ['alt' => 'media']);  // grab the whole file
          $fileContent = $response->getBody()->getContents();
          if ($fileContent !== false) {
            header("HTTP/1.1 200 OK");
            if ( !empty($mimeType) ) header('Content-type: '.$mimeType);
            header('Content-Length: '.strlen($fileContent));
            header('X-Image-Filename: '.$name);
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
            header('Expires: 0'); // For older browsers (HTTP 1.0)
            echo $fileContent;
            exit();
          } else {  // could not get the contents of the file
            error_log("Error downloading file from google Drive ($name) Could not get file contents.");
          }
        } catch (Exception $e) {  // some kind of exception was fired, e.g. it's a google doc, not an actual file
          error_log("Error downloading file from Google Drive ($name) " . $e->getMessage());
        }
        */


        try {  // get the file from Google Drive
          $response = $service->files->get($fileId, ['alt' => 'media']);
          if ($response->getStatusCode() == 200) {
            header("HTTP/1.1 200 OK");
            if (!empty($mimeType)) header('Content-type: ' . $mimeType);
              header('Content-Length: ' . $response->getHeaderLine('Content-Length')); // Get content length from response
              header('X-Image-Filename: ' . $name);
              header('Cache-Control: no-cache, no-store, must-revalidate');
              header('Pragma: no-cache');
              header('Expires: 0');
              fpassthru($response->getBody()->detach()); // Stream the response body directly to the output
              exit();
            } else {
              //header("HTTP/1.1 " . $response->getStatusCode());
              //echo json_encode(['error' => 'Failed to download file.', 'status_code' => $response->getStatusCode()]);
              //exit();
            }
        } catch (Google_Service_Exception $e) {
            error_log('Error downloading file: ' . $e->getMessage());
            //header("HTTP/1.1 500 Internal Server Error");
            //echo json_encode(['error' => 'Failed to download file.']);
            //exit();
        }
      } else {  // no files were in the google drive folder
        error_log("No files found in specified Google Drive.");
      }
    } catch (Exception $e) {  // exception fired on getting drive folder items
      error_log("Error getting items from Google Drive folder " . $e->getMessage());
    }
  } else {  // couldn't find service file
    error_log("Could not open Google Drive API service file.");
  }

  // Something went wrong. Show the error message instead.
  $file = 'arTV-error.jpg';
  header("HTTP/1.1 200 OK");
  header('Content-type: '.mime_content_type($file));
  header('Content-Length: '.filesize($file));
  header('X-Image-Filename: '.$file);
  header('Cache-Control: no-cache, no-store, must-revalidate');
  header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
  header('Expires: 0'); // For older browsers (HTTP 1.0)
  echo file_get_contents($file);
  exit();
}



// ------------------------------ PULL FROM LOCAL ART FOLDER
$files = array();
$directory = 'art';
if ( is_dir($directory) ) {  // get a list of media files from the art directory
  $files = getArt($directory);  // from the main folder, works for every day of the year
  $today = getdate();
  $files = array_merge($files,getArt('art/'.$today['mon']));  // monthly art
  $today = getArt('art/'.$today['mon'].'/'.$today['mon'].'-'.$today['mday']);  // daily art
  if ( count($today) > 0 ) $files = $today;
  // only look at image files
  $files2 = $files;
  $files = array();
  foreach ( $files2 as $file ) {
    $type = @mime_content_type($file);
    if ( !empty($type) && in_array(substr($type,0,5),array('image','video')) ) $files []= $file;
  }

  if ( $debug ) {  // if requested as a list, show the data
    header("HTTP/1.1 200 OK");
    header('Content-type: text/json');
    echo json_encode(array_values($files)); // Encode the file listing as JSON
    exit();
  }
} else {
  error_log("Could not find the download directory: $directory");
}

// return the contents of a random media
//print_r($files);
if ( count($files) > 0 ) $file = $files[array_rand($files,1)];
else $file = 'arTV-error.jpg';
outputFile($file);






function outputFile ( $file ) {
  header("HTTP/1.1 200 OK");
  header('Content-type: '.mime_content_type($file));
  header('Content-Length: '.filesize($file));
  header('X-Image-Filename: '.$file);
  header('Cache-Control: no-cache, no-store, must-revalidate');
  header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
  header('Expires: 0'); // For older browsers (HTTP 1.0)
  //echo file_get_contents($file);  // performance: must load entire file into memory. Not good.
  $handle = fopen($file, "rb");
  if ($handle === false ) {
    header("HTTP/1.1 500 Internal Server Error");
    echo "Error: Could not open file '$filePath'.";
    exit();
  }
  while (!feof($handle)) {
      $buffer = fread($handle, 8192); // Read in 8KB chunks (adjust as needed)
      if ($buffer !== false) {
          echo $buffer;
      } else {
          break;
      }
  }
  fclose($handle);
  exit();
}


// Look at a path and return all the images
function getArt ( $directory ) {
  //echo "\nLooking in $directory ...";
  if ( !is_dir($directory) ) return array();
  $files = scandir($directory); // Get file listing
  $temp = array();
  foreach ( $files as $file ) {
    if ( $file == '.DS_Store' || is_dir($directory.'/'.$file) || substr($file,0,2) == '._' ) continue;
    //if ( !is_array(getimagesize($directory.'/'.$file)) ) continue;
    //if ( filesize($directory.'/'.$file) < 100000 ) continue;
    $temp []= $directory.'/'.$file;
  }
  //echo " found ".count($temp)." files.";
  return $temp;
}
