
local function helpCommand(message, args, meta)
  local commands = {}

  for k, v in pairs(meta.commands) do
    table.insert(commands, k)
  end

  message:reply("```\n" .. table.concat(commands, ", ") .. "```")
end

return {
  run = helpCommand
}
