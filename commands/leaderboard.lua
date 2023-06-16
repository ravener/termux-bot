local discordia = require("discordia")
local round = discordia.extensions.math.round
local search = discordia.extensions.table.search
local slice = discordia.extensions.table.slice

local function reformatInt(i)
  local res = tostring(i):reverse():gsub("%d%d%d", "%1,"):reverse():gsub("^,", "")
  return res
end

local function leaderboardCommand(message, args, meta)
  local page = tonumber(args[1]) or 1
  local rows = meta.db:exec("SELECT * FROM members ORDER BY points DESC")

  if not rows then
    return "No results found, is this a dead server?"
  end

  local totalPages = math.max(round(#rows.id / 10), 1)

  if page > totalPages then
    return string.format("There are only **%d** pages.", totalPages)
  end

  local leaderboard = {}
  local topIDs = slice(rows.id, ((page - 1) * 10) + 1, page * 10)
  local topPoints = slice(rows.points, ((page - 1) * 10) + 1, page * 10)
  local name = user.discriminator ~= "0" and user.tag or user.username
  local aname = message.author.discriminator ~= "0" and message.author.tag or message.author.username

  for i, id in ipairs(topIDs) do
    local points = tonumber(topPoints[i])
    local user = message.client:getUser(id)
    table.insert(leaderboard, string.format("- %s ❯ %s\n    => %s bit%s", tostring(((page - 1) * 10) + i):pad(2, "right", "0"), name, reformatInt(points), points > 1 and "s" or ""))
  end

  local pos = search(rows.id, message.author.id)
  local posTxt = pos == nil and "??" or tostring(pos):pad(2, "right", "0")
  local points = tonumber(rows.points[pos])
  table.insert(leaderboard, string.format("\n+ [%s] ❯ %s\n    => %s bit%s", posTxt, aname, reformatInt(points), points > 1 and "s" or ""))
  return string.format("Leaderboard (Page **%d** out of **%d**)\n```\n%s\n```", page, totalPages, table.concat(leaderboard, "\n"))
end

return {
  run = leaderboardCommand,
  description = "View the most active users",
  aliases = {"lb"},
  guildOnly = true,
  restricted = true
}
