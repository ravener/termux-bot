local http = require("coro-http")
local json = require("json")
local querystring = require("querystring")

local color = 0xFFAB87

local function wikiCommand(msg, args)
  if #args < 1 then
    return "Usage: `!wiki <query>`"
  end

  local query = table.concat(args, " ")
  local res, body = http.request("GET", string.format("https://wiki.termux.com/api.php?action=query&generator=search&gsrsearch=%s&gsrwhat=text&prop=info&inprop=url&format=json", querystring.urlencode(query)))

  if res.code ~= 200 then
    return string.format("I recieved a non-200 status code: %s", res.code)
  end

  local data = json.decode(body)

  if not data.query or not data.query.pages then
    return "No results found."
  end

  local title = string.format("Wiki Search for '%s'", query)

  -- See if we have an exact match.
  for k, v in pairs(data.query.pages) do
    if v.title:lower() == query:lower() then
      return {
        embed = {
          title = title,
          description = string.format("Exact Match Found\n• [%s](%s)", v.title, v.fullurl),
          color = color
        }
      }
    end
  end

  -- Otherwise show all results.
  local description = ""

  for k, v in pairs(data.query.pages) do
    description = description .. string.format("• [%s](%s)", v.title, v.fullurl) .. "\n"
  end

  return {
    embed = {
      title = title,
      description = description,
      color = color
    }
  }
end

return {
  run = wikiCommand,
  description = "Search for an article in the Termux Wiki"
}
