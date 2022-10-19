
local function pingCommand(message)
  message:reply("Pong!")
end

return {
  run = pingCommand,
  aliases = {"pong"},
  description = "Checks if the bot is working."
}
