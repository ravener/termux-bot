local fs = require("fs")
local discordia = require("discordia")
local search = discordia.extensions.table.search

local languages = {}

-- This is hardcoded on purpose.
for i, v in ipairs(fs.readdirSync("../tldr/")) do
  if v:startswith("pages.") then
    table.insert(languages, v:sub(7))
  end
end

local function findPage(cmd, language)
  local suffix = language == "en" and "" or "." .. language
  local dir = "pages" .. suffix

  local platforms = fs.readdirSync(string.format("../tldr/%s", dir))

  for i, platform in pairs(platforms) do
    local path = string.format("../tldr/%s/%s/%s.md", dir, platform, cmd)
    if fs.existsSync(path) then
      local file = fs.readFileSync(path)
      local split = file:split("\n")
      local title = table.remove(split, 1):sub(3)

      return {
        title = title,
        platform = platform,
        description = table.concat(split, "\n")
      }
    end
  end
end

local function tldrCommand(msg, args, meta)
  local cmd = args[1]

  if not cmd then
    return "Usage `!tldr <command> [language=en]`"
  end

  local language = args[2] or "en"

  if language ~= "en" and not search(languages, language) then
    local list = table.concat(languages, ", ")
    return string.format("Invalid language, valid values: %s", list)
  end

  local page = findPage(cmd, language)

  if not page then
    return "Page not found."
  end

  page.description = page.description:gsub("({{(.-)}})","<%2>")

  if meta.general then
    return string.format("%s (%s)\n\n%s", page.title, page.platform, page.description)
  else
    return {
      embed = {
        color = 0xFFAB87,
        title = string.format("%s (%s)", page.title, page.platform),
        description = page.description
      }
    }
  end
end

return {
  description = "TL;DR man pages.",
  run = tldrCommand
}
