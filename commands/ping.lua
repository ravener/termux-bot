
local function pingCommand(message)
  return "Pong!"
end

return {
  run = pingCommand,
  aliases = {"pong"},
  description = "Checks if the bot is working.",
  restricted = true
}
