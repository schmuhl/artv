<?php

$directory = 'art';
$files = scandir($directory); // Get file listing
$files = array_diff($files, array('..','.','.DS_Store') );
header("HTTP/1.1 200 OK");
header('Content-type: text/json');
echo json_encode(array_values($files)); // Encode the file listing as JSON
exit();
