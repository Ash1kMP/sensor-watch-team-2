<?php
/*************************************************************
 * update_db.php
 *
 * Inserts multiple (sensor_id, reading_value) records into the `sensor_readings` table.
 *************************************************************/

// 1) Display errors and warnings
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 2) Make mysqli throw exceptions
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// 3) DB Credentials
$servername = "db5017073076.hosting-data.io";
$dbname     = "dbs13737298";
$username   = "dbu5607697";
$password   = "WinWinLabs2025!!";

// 4) API Key must match what's in your ESP32 code
$api_key_value = "tPmAT5Ab3j7F9";

// A simple sanitation function
function test_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data;
}

// 5) Get the raw POST data as JSON
$input = file_get_contents("php://input");
if (!$input) {
    die("No data posted with HTTP POST.");
}

$decoded = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Invalid JSON data: " . json_last_error_msg());
}

// 6) Verify API key
if (!isset($decoded["api_key"])) {
    die("No API key provided.");
}
$api_key = test_input($decoded["api_key"]);
if ($api_key !== $api_key_value) {
    die("Wrong API Key provided.");
}

// 7) Extract the sensor data payload
if (!isset($decoded["data"])) {
    die("No data provided.");
}
$data = $decoded["data"];
if (!is_array($data)) {
    die("Data should be an array of sensor readings.");
}

// 8) Build the INSERT SQL statement
$sql = "INSERT INTO sensor_readings (sensor_id, reading_value) VALUES ";
$values = [];
foreach ($data as $reading) {
    if (!isset($reading["sensor_id"]) || !isset($reading["reading_value"])) {
        die("Invalid sensor reading: each record must include sensor_id and reading_value.");
    }
    $sensor_id    = test_input($reading["sensor_id"]);
    $reading_value = test_input($reading["reading_value"]);
    $values[] = "('$sensor_id', '$reading_value')";
}
$sql .= implode(", ", $values);

// Optional: Debug output to verify SQL (remove in production)
echo "<pre>About to run SQL: $sql</pre>\n";

// 9) Connect to the database
try {
    $conn = new mysqli($servername, $username, $password, $dbname);
} catch (Exception $e) {
    die("DB Connection failed: " . $e->getMessage());
}
if ($conn->connect_error) {
    die("DB Connection failed: " . $conn->connect_error);
}

// 10) Execute the INSERT query
try {
    $conn->query($sql);
    echo "New sensor_readings records created successfully";
} catch (Exception $ex) {
    echo "<strong>SQL Error:</strong> " . $ex->getMessage() . "<br>";
    echo "<strong>Query was:</strong> $sql<br>";
}

$conn->close();
?>
