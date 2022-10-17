
local function pingCommand(message)
  message:reply("Pong!")
end

return {
  run = pingCommand,
  aliases = {"pong"}
}
