
local function helpCommand(message, args, meta)
  local help = "= Commands =\n\n"
  local commands = {}

  for k, v in pairs(meta.commands) do
    if not v.ownerOnly or v.ownerOnly and message.author.id == meta.config.owner then
      local description = v.description or "No Description Provided."
      help = help .. k:pad(8) .. ":: " .. description .. "\n"
    end
  end

  message:reply(string.format("```\n%s```", help))
end

return {
  run = helpCommand,
  description = "Get help about a command."
}
