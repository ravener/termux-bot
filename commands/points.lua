
function reformatInt(i)
  return tostring(i):reverse():gsub("%d%d%d", "%1,"):reverse():gsub("^,", "")
end

local function pointsCommand(message, args, meta)
  local points = meta.db:rowexec("SELECT (points) FROM members WHERE id = " .. "'" .. message.author.id .. "'")

  if not points then
    return "You have no points."
  end

  local level = math.floor(0.1 * math.sqrt(tonumber(points))) + 1
  local bits = reformatInt(tonumber(points))
  local nextLevel = (level + 1)^2 * 100
  local nextPoints = reformatInt(nextLevel - tonumber(points))
  return string.format("You are currently level **%d** with **%s** bits.\nYou need **%s** bits for the next level (**%s** more to go!)", level, bits, rereformatInt(nextLevel), nextPoints)
end

return {
  run = pointsCommand,
  description = "Check your current activity points.",
  aliases = {"balance", "bal", "bits", "profile", "level"}
}
