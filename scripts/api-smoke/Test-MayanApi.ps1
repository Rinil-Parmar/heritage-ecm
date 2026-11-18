[CmdletBinding()]
param(
    [string]$BaseUrl = "https://archeoecm.cs.uwindsor.ca",
    [string]$Username
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$BaseUrl = $BaseUrl.TrimEnd("/")
$apiRoot = "$BaseUrl/api/v4/"
$documentsUrl = "$BaseUrl/api/v4/documents/"
$tokenUrl = "$BaseUrl/api/v4/auth/token/obtain/"

if (-not $Username) {
    $Username = Read-Host "Mayan test username"
}
if (-not $Username) {
    throw "A Mayan username is required."
}

$securePassword = Read-Host "Mayan password" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$plainPassword = $null
$token = $null
$client = $null

function Send-Request {
    param(
        [Net.Http.HttpClient]$Client,
        [Net.Http.HttpMethod]$Method,
        [string]$Url,
        [string]$JsonBody,
        [string]$AuthToken
    )

    $request = New-Object Net.Http.HttpRequestMessage($Method, $Url)
    try {
        $request.Headers.Accept.ParseAdd("application/json")
        if ($AuthToken) {
            $request.Headers.Authorization = New-Object Net.Http.Headers.AuthenticationHeaderValue("Token", $AuthToken)
        }
        if ($JsonBody) {
            $request.Content = New-Object Net.Http.StringContent($JsonBody, [Text.Encoding]::UTF8, "application/json")
        }
        $response = $Client.SendAsync($request).GetAwaiter().GetResult()
        try {
            [pscustomobject]@{
                Status = [int]$response.StatusCode
                Body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
        }
        finally {
            $response.Dispose()
        }
    }
    finally {
        $request.Dispose()
    }
}

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $handler = New-Object -TypeName Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $false
    $client = New-Object -TypeName Net.Http.HttpClient -ArgumentList $handler
    $client.Timeout = [TimeSpan]::FromSeconds(15)

    Write-Host "[1/4] Checking API reachability..."
    $root = Send-Request $client ([Net.Http.HttpMethod]::Get) $apiRoot
    if ($root.Status -ge 500 -or $root.Status -eq 0) {
        throw "API root returned HTTP $($root.Status)."
    }
    Write-Host "PASS: API endpoint responded with HTTP $($root.Status)."

    Write-Host "[2/4] Checking anonymous document access..."
    $anonymous = Send-Request $client ([Net.Http.HttpMethod]::Get) $documentsUrl
    if ($anonymous.Status -in @(401, 403)) {
        Write-Host "PASS: Anonymous document access was denied with HTTP $($anonymous.Status)."
    }
    elseif ($anonymous.Status -eq 200) {
        try {
            $anonymousPayload = $anonymous.Body | ConvertFrom-Json
        }
        catch {
            throw "Anonymous document request returned HTTP 200 but the body was not valid JSON."
        }
        $anonymousCount = if ($null -ne $anonymousPayload.count) {
            [int]$anonymousPayload.count
        }
        else {
            @($anonymousPayload).Count
        }
        if ($anonymousCount -gt 0) {
            Write-Warning "Anonymous API access can see $anonymousCount document(s). Review Mayan anonymous permissions before frontend work."
        }
        else {
            Write-Host "PASS: Anonymous listing is reachable but exposes zero documents."
        }
    }
    else {
        throw "Anonymous document request returned unexpected HTTP $($anonymous.Status)."
    }

    Write-Host "[3/4] Obtaining an API token..."
    $credentials = @{username = $Username; password = $plainPassword} | ConvertTo-Json -Compress
    $tokenResponse = Send-Request $client ([Net.Http.HttpMethod]::Post) $tokenUrl $credentials
    if ($tokenResponse.Status -ne 200) {
        throw "Authentication failed with HTTP $($tokenResponse.Status). Check the username and password."
    }
    $tokenPayload = $tokenResponse.Body | ConvertFrom-Json
    $token = if ($tokenPayload.token) { $tokenPayload.token } else { $tokenPayload.key }
    if (-not $token) {
        throw "Authentication succeeded but the response did not contain a token."
    }
    Write-Host "PASS: Mayan authenticated the user. The token is not displayed or saved by this script."

    Write-Host "[4/4] Listing documents with the authenticated account..."
    $documents = Send-Request $client ([Net.Http.HttpMethod]::Get) $documentsUrl $null $token
    if ($documents.Status -ne 200) {
        throw "Authenticated document request returned HTTP $($documents.Status)."
    }
    $documentPayload = $documents.Body | ConvertFrom-Json
    $documentCount = if ($null -ne $documentPayload.count) {
        [int]$documentPayload.count
    }
    else {
        @($documentPayload).Count
    }
    Write-Host "PASS: Authenticated document listing returned HTTP 200 (visible documents: $documentCount)."
    Write-Host "API SMOKE TEST PASSED"
}
finally {
    $token = $null
    $plainPassword = $null
    if ($client) { $client.Dispose() }
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}
