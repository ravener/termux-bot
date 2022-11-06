local discordia = require("discordia")
discordia.extensions.string()

local timer = require("timer")
local fs = require("fs")
local json = require("json")
local pathjoin = require("pathjoin")
local pp = require("pretty-print")

local config = json.decode(fs.readFileSync("config.json"))
local status = json.decode(fs.readFileSync("status.json"))
local logLevel = discordia.enums.logLevel

local client = discordia.Client({
  logLevel = config.dev and logLevel.debug or logLevel.info
})

local count = discordia.extensions.table.count
local commands = {}
local aliases = {}
local DIR = "./commands"
local replies = {}
local timeouts = {}

local env = setmetatable({
  require = require, -- inject luvit's custom require
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

-- Setup database
local sqlite = require("sqlite3")
local db = sqlite.open("db.sqlite")

db:exec[[
CREATE TABLE IF NOT EXISTS "members" (
  id TEXT PRIMARY KEY NOT NULL,
  points INTEGER NOT NULL DEFAULT 0
)
]]

local stmt = db:prepare("INSERT INTO members (id, points) VALUES(?, ?) ON CONFLICT DO UPDATE SET points = points + ? RETURNING *")

client:on("ready", function()
  client:setGame(status[math.random(#status)])

  -- Set a random status every minute.
  timer.setInterval(60 * 1000, function ()
    coroutine.wrap(client.setGame)(client, status[math.random(#status)])
  end)
end)

local prefix = config.dev and "d!" or "!"
local activeRole = "803685296083828736"

local function handlePoints(message)
  -- Ignores bots and DMs
  if not message.guild or message.author.bot then return end
  -- Ignore the #memes and #bots channels.
  if message.channel.id == "820869096894890015" or message.channel.id == "641655510692790286" then return end
  -- Ignore staff category
  if message.channel.category and message.channel.category.id == "810520642248114176" then return end
  -- Ignore messages shorter than 5 characters.
  -- This should prevent most short messages like:
  -- ok, okay, no, hi, lmao, wait, what, wow, etc.
  -- So points are earned by meaninful conversations instead.
  if #message.content < 5 then return end
  -- If user is on a timeout, it doesn't count.
  if timeouts[message.author.id] then return end
  
  -- Ignore bot commands.
  for i, v in pairs({ "!", "?", "/", "n!", "./" }) do
    if message.content:startswith(v) then return end
  end

  -- Earn a random point between 4 to 12.
  -- #proficient channel is restricted to only 4 points.
  local points = message.channel.id == "820884038373605387" and 4 or math
  random(4, 12)
  local rows = stmt:reset():bind(message.author.id, points, points):step()

  -- Timeout the user.
  -- Multiple messages in a window of 5 seconds won't count.
  timeouts[message.author.id] = true
  timer.setTimeout(6000, function ()
    timeouts[message.author.id] = nil
  end)

  if tonumber(rows[2]) >= 8192 and not message.member:hasRole(activeRole) then
    message.member:addRole(activeRole)

    local modlogs = guild:getChannel("810521091973840957")

    modlogs:send {
      embed = {
        title = "Active Role Handout",
        color = 0x00FF00,
        author = { name = message.author.tag, icon_url = message.author.getAvatarURL() },
        description = string.format("Given the active role to **%s**", message.author.tag),
        footer = { text = string.format("User ID: %s", message.author.id) }
      }
    }
  end
end

local function handleCommands(message)
  if message.author.bot then return end
  if message.channel.id == "641256914684084237" then return end
  if not message.content:startswith(prefix) then return end

  local args = message.content:sub(#prefix + 1):trim():split("[\n\t ]+")
  local command = table.remove(args, 1)
  local cmd = commands[command] or commands[aliases[command]]

  if not cmd then return end

  if cmd.guildOnly and not message.guild then
    message:reply("This command can only be ran in a server.")
    return true
  end

  if cmd.ownerOnly and message.author.id ~= config.owner then
    message:reply("This command can only be ran by the bot owner.")
    return true
  end

  local success, value = pcall(function ()
    return cmd.run(message, args, {
      commands = commands,
      aliases = aliases,
      rawArgs = message.content:sub(#prefix + #command + 1),
      config = config,
      db = db
    })
  end)

  if not success then
    message:reply(string.format("```lua\n%s```", pp.strip(pp.dump(value))))
    return true
  end

  local content
  local reply, err

  if type(value) == "string" and #value > 0 then
    content = {
      content = value,
      reference = { message = message }
    }
  elseif type(value) == "table" then
    value.reference = { message = message }
    content = value
  end

  if content then
    if replies[message.id] then
      _, err = replies[message.id]:update(content)
    else
      reply, err = message:reply(content)
    end
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

  return true
end

client:on("messageCreate", function (message)
  if not handleCommands(message) then
    handlePoints(message)
  end
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

local function quote(s) return "'" .. s .. "'" end

client:on("memberLeave", function (member)
  db:exec("DELETE FROM members WHERE id = " .. quote(member.id))
end)

client:run(config.token)
