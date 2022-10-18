local fs = require("fs")
local http = require("coro-http")
local color = 0xFFAB87

-- Fetch the package index for the given repo and arch.
local function fetch(repo, arch)
  local dir = {"stable", "main"}
  
  if repo == "x11" then dir = {"x11", "main"} end
  if repo == "root" then dir = {"root", "stable"} end

  local url = string.format("https://grimler.se/termux-%s/dists/%s/%s/binary-%s/Packages", repo, dir[1], dir[2], arch)
  local res, body = http.request("GET", url)

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
  
  if not fs.existsSync(path) then
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
        info[name][line[1]] = line[2]
        x = x + 1
        if lines[i + x] == "" then break end
      end
    end
  end

  return info
end

local function pkgCommand(msg, args)
  if #args < 1 then
    msg:reply("Usage: `!pkg <package name> [repo=main] [arch=aarch64]`")
    return
  end

  local pkg = args[1]:lower()
  local repo = (args[2] or "main"):lower()
  local arch = (args[3] or "aarch64"):lower()

  if repo ~= "main" and repo ~= "x11" and repo ~= "root" then
    return msg:reply("Invalid repository given.\n\nValid values include: main, x11, root")
  end

  if arch ~= "all" and arch ~= "arm" and arch ~= "aarch64" and arch ~= "x86_64" and arch ~= "i686" then
    return msg:reply("Invalid arch given.\n\nValid values include: arm, aarch64, x86_64, i686")
  end

  local index = parseIndex(fetchIndex(repo, arch))
  
  if not index[pkg] then
    return msg:reply("Package not found.")
  end
  
  local results = ""

  for k, v in pairs(index[pkg]) do
    results = results .. k .. ": " .. v .. "\n"
  end

  return msg:reply(string.format("```\n%s```", results))
end

return {
  run = pkgCommand
}
