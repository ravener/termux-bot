local discordia = require("discordia")
discordia.extensions.string()

local timer = require("timer")
local fs = require("fs")
local json = require("json")
local pathjoin = require("pathjoin")
local pp = require("pretty-print")
local config = json.decode(fs.readFileSync("config.json"))
local status = json.decode(fs.readFileSync("status.json"))
local client = discordia.Client()
local count = discordia.extensions.table.count
local commands = {}
local aliases = {}
local DIR = "./commands"
local replies = {}

local env = setmetatable({
  require = require, -- inject luvit's custom require
  loader = loader, -- inject this module
}, {__index = _G})

for k, v in fs.scandirSync(DIR) do
  if k:endswith(".lua") then
    local name = k:match("(.*)%.lua")
    local success, err = pcall(function ()
      local path = pathjoin.pathJoin(DIR, name) .. ".lua"
      local fn = assert(loadstring(fs.readFileSync(path), "@" .. name, "t", env))
      commands[name] = fn() or {}
    end)

    if success then
      if commands[name].aliases then
        for i, v in ipairs(commands[name].aliases) do
          aliases[v] = name
        end
      end
      client:info("Loaded command '%s'", name)
    else
      client:error("Failed to load '%s': " .. err, name)
    end
  end
end

client:on("ready", function()
  client:setGame(status[math.random(#status)])

  -- Set a random status every minute.
  timer.setInterval(60 * 1000, coroutine.wrap(function ()
    client:setGame(status[math.random(#status)])
  end))
end)

local prefix = config.dev and "d!" or "!"

function handleCommands(message)
  if message.author.bot then return end
  if not message.content:startswith(prefix) then return end

  local args = message.content:sub(#prefix + 1):trim():split("[\n\t ]+")
  local command = table.remove(args, 1)
  local cmd = commands[command] or commands[aliases[command]]

  if not cmd then return end

  if cmd.guildOnly and not message.guild then
    message:reply("This command can only be ran in a server.")
    return
  end

  if cmd.ownerOnly and message.author.id ~= config.owner then
    message:reply("This command can only be ran by the bot owner.")
    return
  end

  local success, value = pcall(function ()
    return cmd.run(message, args, {
      commands = commands,
      aliases = aliases,
      rawArgs = message.content:sub(#prefix + #command + 1),
      config = config
    })
  end)

  if not success then
    message:reply(string.format("```lua\n%s```", pp.strip(pp.dump(value))))
  end

  local content
  local reply, err

  if type(value) == "string" then
    content = {
      content = value,
      reference = { message = message }
    }
  elseif type(value) == "table" then
    value.reference = { message = message }
    content = value
  end

  if replies[message.id] then
    _, err = replies[message.id]:update(content)
  else
    reply, err = message:reply(content)
  end

  if reply then
    -- Limit cache size.
    if count(replies) > 100 then
      replies = {}
    end

    replies[message.id] = reply
  elseif err then
    client:error(err)
  end
end

client:on("messageCreate", function (message)
  handleCommands(message)
end)

client:on("messageUpdate", function (message)
  handleCommands(message)
end)

client:on("messageDelete", function (message)
  if message.author == client.user then
    for k, reply in pairs(replies) do
      if message == reply then
        replies[k] = nil
      end
    end
  else
    if replies[message.id] then
      replies[message.id]:delete()
      replies[message.id] = nil
    end
  end
end)

client:run(config.token)
