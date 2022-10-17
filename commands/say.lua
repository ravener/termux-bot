
local function sayCommand(message, args)
  message:reply("You said: " .. table.concat(args, " "))
end

return {
  run = sayCommand,
  aliases = {"talk"}
}
