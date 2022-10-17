local discordia = require("discordia")
discordia.extensions.string()

local fs = require("fs")
local json = require("json")
local pathjoin = require("pathjoin")
local pp = require("pretty-print")
local config = json.decode(fs.readFileSync("config.json"))
local client = discordia.Client()
local commands = {}
local aliases = {}
local DIR = "./commands"

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
  print("Logged in as " .. client.user.username)
end)

local prefix = config.dev and "d!" or "!"

client:on("messageCreate", function(message)
  local content = message.content

  if not content:startswith(prefix) then return end

  local args = content:sub(#prefix + 1):trim():split(" ")
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

  local success, err = pcall(function ()
    cmd.run(message, args, {
      commands = commands,
      aliases = aliases,
      rawArgs = content:sub(#command + 2)
    })
  end)

  if not success then
    message:reply(string.format("```lua\n%s```", pp.strip(pp.dump(err))))
  end
end)

client:run(config.token)
