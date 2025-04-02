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
      //return;
    }
  } else {
    error_log("Failed to read config file: $configFile");
    //return;
  }
  // process values
  //print_r($config);
}


// PULL FROM GOOGLE DRIVE
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
          'q' => "'".$config->GoogleDrive->folderID."' in parents and mimeType contains 'image/'", // Filter for images
          'fields' => 'files(id, name, mimeType)',
      ]);
      $files = $results->getFiles();

      if ( count($files) > 0 ) {
        //print_r($files); die();
        //print_r(count($files)); die();
        $file = $files[rand(0,count($files)-1)];
        print_r($file); die();

        $fileId = $file->id; //access id as an object property.
        $name = $file->getName();

        try {
          $response = $service->files->get($fileId, ['alt' => 'media']);
          $fileContent = $response->getBody()->getContents();

          if ($fileContent !== false) {

            // try to determine the mime file type
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ( $finfo ) {
              $mimeType = finfo_buffer($finfo, $fileContent);
            } else $mimeType = null;
            finfo_close($finfo);

            header("HTTP/1.1 200 OK");
            if ( $mimeType ) header('Content-type: '.$mimeType);
            header('Content-Length: '.strlen($fileContent));
            header('X-Image-Filename: '.$name);
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache'); // For older browsers (HTTP 1.0)
            header('Expires: 0'); // For older browsers (HTTP 1.0)
            echo $fileContent;
            exit();
          } else {  // could not get the contents of the file
            error_log("Error downloading file from google Drive ($name) Could not get file contents.");
            //echo "Error downloading $name.\n"; die();
            //exit(1);
          }
        } catch (Exception $e) {  // some kind of exception was fired, e.g. it's a google doc, not an actual file
          error_log("Error downloading file from Google Drive ($name) " . $e->getMessage());
          //echo "Error downloading file from Google Drive ($name) " . $e->getMessage(); die();
        }
      } else {  // no files were in the google drive folder
        echo "No files found in specified Google Drive."; die();
        //exit(1);
      }
    } catch (Exception $e) {  // exception fired on getting drive folder items
      error_log("Error getting items from Google Drive folder " . $e->getMessage());
      //echo "Error getting items from Google Drive folder " . $e->getMessage(); die();
    }
  } else {  // couldn't find service file
    echo "Could not open Google Drive API service file."; die();
    //exit(1);
  }

  // Something went wrong. Show the error message.
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


// PULL FROM LOCAL ART FOLDER
$directory = 'art';
if ( !is_dir($directory) ) { // ensure the download directory exists
  echo "Could not find the download directory.\n";
  exit(1);
}
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
  if ( !empty($type) && in_array(substr($type,0,5),array('image')) ) $files []= $file;
}
if ( isset($_GET['debug']) ) {
  print_r($files);
  exit();
}


// if requested as an image, return the contents of a random image instead of a list of files
if ( isset($_GET['image']) ) {
  //print_r($files);
  if ( count($files) > 0 ) $file = $files[array_rand($files)];
  else $file = 'arTV-error.jpg';
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



// show the data
header("HTTP/1.1 200 OK");
header('Content-type: text/json');
echo json_encode(array_values($files)); // Encode the file listing as JSON
exit();



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
