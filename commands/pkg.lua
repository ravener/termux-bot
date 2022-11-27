local fs = require("fs")
local discordia = require("discordia")
local http = require("coro-http")
local round = discordia.extensions.math.round
local color = 0xFFAB87


local function getDownloadURL(repo, filename)
  if repo == "tur" then
    return string.format("https://tur.kcubeterm.com/%s", filename)
  end

  return string.format("https://grimler.se/termux-%s/%s", repo, filename)
end

local function getURL(repo, arch)
  if repo == "tur" then
    return string.format("https://tur.kcubeterm.com/dists/tur-packages/tur/binary-%s/Packages", arch)
  end

  local dir = {"stable", "main"}
  
  if repo == "x11" then dir = {"x11", "main"} end
  if repo == "root" then dir = {"root", "stable"} end

  return string.format("https://grimler.se/termux-%s/dists/%s/%s/binary-%s/Packages", repo, dir[1], dir[2], arch)
end

-- Fetch the package index for the given repo and arch.
local function fetch(repo, arch)
  local res, body = http.request("GET", getURL(repo, arch))

  if res.code ~= 200 then
    error(string.format("Non-200 Status Code: %d", res.code))
  end

  return body
end

-- Fetches the package index and caches it into filesystem.
local function download(repo, arch)
  local index = fetch(repo, arch)

  if not fs.existsSync("data") then
    fs.mkdirSync("data")
  end

  fs.writeFileSync(string.format("data/%s-%s", repo, arch), index)
  return index
end

-- Reads the package index file from filesystem if available
-- otherwise fetches it and caches it.
local function fetchIndex(repo, arch)
  local path = string.format("data/%s-%s", repo, arch)
  local stats = fs.statSync(path)

  if not stats or (os.time() - stats.mtime.sec) > 6 * 60 * 60 then
    return download(repo, arch)
  end

  return fs.readFileSync(path)
end

-- Parses the index file into a lua table.
local function parseIndex(index)
  local lines = index:split("\n")
  local info = {}

  for i, v in ipairs(lines) do
    if v:startswith("Package:") then
      local name = v:split(": ")[2]
      info[name] = {}
      local x = 0
      while true do
        local line = lines[i + x]:split(": ")
        info[name][line[1]:lower()] = line[2]
        x = x + 1
        if lines[i + x] == "" then break end
      end
    end
  end

  return info
end

local function humanize(size)
  if size > 1024 then
    return tostring(round(size / 1024, 2)) .. " MB"
  end

  return tostring(round(size, 2)) .. " KB"
end

local function pkgCommand(msg, args)
  if #args < 1 then
    return "Usage: `!pkg <package name> [repo=main] [arch=aarch64]`"
  end

  local pkg = args[1]:lower()
  local repo = (args[2] or "main"):lower()
  local arch = (args[3] or "aarch64"):lower()

  if repo ~= "main" and repo ~= "x11" and repo ~= "root" and repo ~= "tur" then
    return "Invalid repository given.\n\nValid values include: main, x11, root, tur"
  end

  if arch ~= "all" and arch ~= "arm" and arch ~= "aarch64" and arch ~= "x86_64" and arch ~= "i686" then
    return "Invalid arch given.\n\nValid values include: all, arm, aarch64, x86_64, i686"
  end

  local index = parseIndex(fetchIndex(repo, arch))
  
  if not index[pkg] then
    return string.format("Package not found in `%s` repository.", repo)
  end

  local info = index[pkg]
  local hashes = string.format("**MD5:** %s\n**SHA1:** %s\n**SHA256:** %s\n**SHA512:** %s", info.md5sum, info.sha1, info.sha256, info.sha512)
  local installedSize = humanize(tonumber(info["installed-size"]))
  local size = humanize(tonumber(info.size) / 1024)
  local url = getDownloadURL(repo, info.filename)
  local deb = string.format("📥 [.deb](%s) (%s)", url, size)

  local fields = {
    { name = "Version", value = info.version },
    { name = "Maintainer", value = info.maintainer },
    { name = "Homepage", value = info.homepage },
    { name = "Hashes", value = hashes },
    { name = "Installed Size", value = installedSize },
    { name = "Download", value = deb },
    { name = "Depends", value = info.depends or "None" },
    { name = "Breaks", value = info.breaks or "None" },
    { name = "Replaces", value = info.replaces or "None" },
    { name = "Essential", value = info.essential or "No" }
  }

  local title = string.format("Package information for '%s' (%s)", pkg, arch)

  if meta.general then
    local results = title .. "\n"

    for i, v in ipairs(fields) do
      results = results .. string.format("\n• **%s:** %s", v.name, v.value)
    end

    return results
  else
    return {
      embed = {
        title = title,
        color = color,
        description = info.description,
        fields = fields
      }
    }
  end
end

return {
  run = pkgCommand,
  description = "Show information about a package."
}
