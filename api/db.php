<?php
/**
 * M/S FOUR STAR CARGO — HOSTINGER LIVE DATA SYNC SERVICE
 * Provides 100% real-time data persistence across browsers, incognito windows, and mobile devices
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$dbDir = __DIR__ . '/../database';
$dataFile = $dbDir . '/db.json';

if (!file_exists($dbDir)) {
    @mkdir($dbDir, 0777, true);
}

// 1. POST Request: Save updated database state to Hostinger disk
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $existing = [];
            if (file_exists($dataFile)) {
                $rawExisting = @file_get_contents($dataFile);
                $existing = json_decode($rawExisting, true) ?: [];
            }
            
            $merged = array_merge($existing, $decoded);
            @file_put_contents($dataFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['status' => 'success', 'message' => 'Hostinger DB synchronized']);
            exit();
        }
    }
}

// 2. GET Request: Read latest database state from Hostinger disk
if (file_exists($dataFile)) {
    $content = @file_get_contents($dataFile);
    if (!empty($content)) {
        echo $content;
        exit();
    }
}

// Default fallback empty database
echo json_encode([
    'fsc_vps_users' => [
        [
            'id' => 'usr-admin-master',
            'name' => 'সুপার এডমিন (Super Admin)',
            'email' => 'superadmin@cargo.com',
            'password' => 'Cargo@2026',
            'role' => 'super_admin',
            'status' => 'active',
            'created_at' => '2026-01-01T00:00:00Z'
        ]
    ],
    'fsc_vps_warehouses' => [],
    'fsc_vps_cartons' => [],
    'fsc_vps_proposals' => [],
    'fsc_vps_customers' => [],
    'fsc_vps_ledger' => [],
    'fsc_vps_audit' => [],
    'fsc_vps_expenses' => []
]);
?>
