param(
    [Parameter(Mandatory=$true)]
    [string]$FileToUpdate
)

$containerName = "flexspotff-postgres-1"
# This takes the backup files that Chris is creating, just ask him for a fresh copy.

# This switches the working directory to root directory of the project
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..")

# Gets the environmental variables so we can parse it and sync
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
} else {
    Write-Error ".env file not found"
    exit 1
}

# Get the database name
$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Error "DATABASE_URL not found in environment variables"
    exit 1
}

$database = ($databaseUrl -split '/')[-1]

# These need to be separate because drop database can't be in a transaction
Write-Host "Terminating existing connections to database '$database'..."
docker exec -i $containerName psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$database' AND pid <> pg_backend_pid();"

Write-Host "Dropping database '$database'..."
docker exec -i $containerName psql -U postgres -c "DROP DATABASE IF EXISTS $database;"

Write-Host "Creating database '$database'..."
docker exec -i $containerName psql -U postgres -c "CREATE DATABASE $database OWNER postgres;"

# Check if file is gzipped and handle accordingly
if ($FileToUpdate -match "\.gz$") {
    Write-Host "Restoring from gzipped file: $FileToUpdate"
    # Use 7-Zip or built-in PowerShell compression if available
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        7z x -so $FileToUpdate | docker exec -i $containerName psql -U postgres -d $database
    } elseif (Get-Command "Expand-Archive" -ErrorAction SilentlyContinue) {
        # For .gz files, we need to use a different approach since Expand-Archive doesn't support .gz
        Write-Warning "PowerShell's Expand-Archive doesn't support .gz files. Please install 7-Zip or use WSL."
        Write-Host "Attempting to use docker to decompress..."
        docker run --rm -v "${PWD}:/data" alpine:latest sh -c "gunzip -c /data/$FileToUpdate" | docker exec -i $containerName psql -U postgres -d $database
    } else {
        Write-Error "No suitable decompression tool found. Please install 7-Zip or use WSL for .gz files."
        exit 1
    }
} else {
    Write-Host "Restoring from uncompressed file: $FileToUpdate"
    Get-Content $FileToUpdate -Raw | docker exec -i $containerName psql -U postgres -d $database
}

Write-Host "Database sync completed successfully!"
