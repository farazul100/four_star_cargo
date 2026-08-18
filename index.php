<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER PRODUCTION ENTRY POINT
 * Serves the compiled Vite web app from /dist/index.html seamlessly
 */

$distIndex = __DIR__ . '/dist/index.html';
if (file_exists($distIndex)) {
    // If request is for root or SPA route, serve compiled dist/index.html
    header('Content-Type: text/html; charset=utf-8');
    echo file_get_contents($distIndex);
    exit();
}

$rootIndex = __DIR__ . '/index.html';
if (file_exists($rootIndex)) {
    header('Content-Type: text/html; charset=utf-8');
    echo file_get_contents($rootIndex);
    exit();
}

header("HTTP/1.1 503 Service Unavailable");
echo "Application is updating... Please refresh in a few seconds.";
?>
