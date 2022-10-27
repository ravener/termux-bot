
function reformatInt(i)
  return tostring(i):reverse():gsub("%d%d%d", "%1,"):reverse():gsub("^,", "")
end

local function pointsCommand(message, args, meta)
  local points = meta.db:rowexec("SELECT (points) FROM members WHERE id = " .. "'" .. message.author.id .. "'")

  if not points then
    return "You have no points."
  end

  local level = math.floor(0.1 * math.sqrt(tonumber(points)))
  local bits = reformatInt(tonumber(points))
  return string.format("You are **level %d** with **%d bits**", level, bits)
end

return {
  run = pointsCommand,
  description = "Check your current activity points.",
  aliases = {"balance", "bal", "bits", "profile", "level"}
}
