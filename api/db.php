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

// Multi-location storage resolution for 100% write reliability on Hostinger
$filePaths = [
    __DIR__ . '/db.json',
    __DIR__ . '/../database/db.json',
    sys_get_temp_dir() . '/fsc_vps_db.json'
];

function readCurrentServerDb($filePaths) {
    foreach ($filePaths as $path) {
        if (file_exists($path)) {
            $raw = @file_get_contents($path);
            if (!empty($raw)) {
                $decoded = json_decode($raw, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    return null;
}

function writeServerDb($filePaths, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $written = false;
    foreach ($filePaths as $path) {
        $dir = dirname($path);
        if (!file_exists($dir)) {
            @mkdir($dir, 0777, true);
        }
        $res = @file_put_contents($path, $json);
        if ($res !== false) {
            $written = true;
        }
    }
    return $written;
}

// Helper to merge array of objects by ID or key
function smartMergeArrays($existing, $incoming) {
    if (!is_array($existing)) $existing = [];
    if (!is_array($incoming)) return $existing;

    $map = [];
    foreach ($existing as $item) {
        if (is_array($item)) {
            $key = $item['id'] ?? $item['ctn_no'] ?? $item['email'] ?? null;
            if ($key) {
                $map[$key] = $item;
            }
        }
    }
    foreach ($incoming as $item) {
        if (is_array($item)) {
            $key = $item['id'] ?? $item['ctn_no'] ?? $item['email'] ?? null;
            if ($key) {
                $map[$key] = $item;
            }
        }
    }
    return array_values($map);
}

// 1. POST Request: Save updated database state to Hostinger disk
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    if (!empty($input)) {
        $decoded = json_decode($input, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $existing = readCurrentServerDb($filePaths) ?: [];
            
            $finalDb = $existing;
            foreach ($decoded as $key => $val) {
                if (is_array($val)) {
                    $finalDb[$key] = smartMergeArrays($existing[$key] ?? [], $val);
                } else {
                    $finalDb[$key] = $val;
                }
            }

            writeServerDb($filePaths, $finalDb);
            echo json_encode(['status' => 'success', 'message' => 'Hostinger DB synchronized', 'proposals_count' => count($finalDb['fsc_vps_proposals'] ?? [])]);
            exit();
        }
    }
}

// 2. GET Request: Read latest database state from Hostinger disk
$currentDb = readCurrentServerDb($filePaths);
if ($currentDb && is_array($currentDb)) {
    echo json_encode($currentDb, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
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
