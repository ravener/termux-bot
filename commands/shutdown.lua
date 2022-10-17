local os = require("os")

local function shutdownCommand(message)
  message:reply("Shutting down...")
  message.client:stop()
  os.exit()
end

return {
  run = shutdownCommand,
  ownerOnly = true
}
