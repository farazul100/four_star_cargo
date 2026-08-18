<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER PRODUCTION ENTRY POINT
 * Serves compiled dist/index.html cleanly with 100% HTTP/2 protocol compatibility
 */

$distIndex = __DIR__ . '/dist/index.html';
if (file_exists($distIndex)) {
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($distIndex);
    exit();
}

$rootIndex = __DIR__ . '/index.html';
if (file_exists($rootIndex)) {
    http_response_code(200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($rootIndex);
    exit();
}

http_response_code(503);
echo "Application is updating...";
?>
