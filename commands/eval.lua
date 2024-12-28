local pp = require("pretty-print")
local sandbox = setmetatable({}, { __index = _G })

local function printLine(...)
  local ret = {}
  for i = 1, select('#', ...) do
    local arg = tostring(select(i, ...))
    table.insert(ret, arg)
  end
  return table.concat(ret, '\t')
end

local function prettyLine(...)
  local ret = {}
  for i = 1, select('#', ...) do
    local arg = pp.strip(pp.dump(select(i, ...)))
    table.insert(ret, arg)
  end
  return table.concat(ret, '\t')
end

local function code(str)
  return string.format('```\n%s```', str)
end

local function evalCommand(message, args, meta)
  -- Strip markdown codeblocks
  local arg = meta.rawArgs:gsub('```lua\n?', ''):gsub('```\n?', '')
  local lines = {}

  sandbox.message = message
  sandbox.client = message.client
  sandbox.guild = message.guild
  sandbox.channel = message.channel
  sandbox.require = require
  sandbox.meta = meta
  sandbox.db = meta.db

  sandbox.print = function(...)
    table.insert(lines, printLine(...))
  end

  sandbox.p = function(...)
    table.insert(lines, prettyLine(...))
  end

  local fn, syntaxError = load(arg, 'DiscordBot', 't', sandbox)
  if not fn then return code(syntaxError) end

  local success, runtimeError = pcall(fn)
  if not success then return code(runtimeError) end

  local lines = table.concat(lines, '\n')

  if #lines > 1990 then -- truncate long messages
    lines = lines:sub(1, 1990)
  end

  if #lines > 0 then
    return code(lines)
  end
end

return {
  run = evalCommand,
  aliases = {"lua"},
  ownerOnly = true,
  description = "Evaluates Lua code",
  disabled = true
}
