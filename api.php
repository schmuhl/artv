<?php

$directory = 'art';
$files = scandir($directory); // Get file listing
$temp = array();
foreach ( $files as $file ) {
  if ( $file == '.DS_Store' || is_dir($directory.'/'.$file) || substr($file,0,2) == '._' ) continue;
  $temp []= $file;
}
$files = $temp;

header("HTTP/1.1 200 OK");
header('Content-type: text/json');
echo json_encode(array_values($files)); // Encode the file listing as JSON
exit();
