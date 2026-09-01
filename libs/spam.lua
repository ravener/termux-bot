-- Detects a member cross-posting the same attachment (or near-identical text)
-- across multiple channels within a short window, then deletes and times them out.
-- Messages without attachments are ignored entirely: text-only spam is already
-- covered by AutoMod and Dyno, this targets the cross-channel attachment class.

local http = require('coro-http')
local openssl = require('openssl')
local timer = require('timer')
local snowflakes = require('snowflakes')

local WINDOW_MS = 60 * 1000
local CHANNEL_THRESHOLD = 3
local TEXT_SIMILARITY_THRESHOLD = 0.85
local MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
local MAX_ATTACHMENTS_PER_MESSAGE = 10
local MAX_TOTAL_BYTES_PER_MESSAGE = MAX_ATTACHMENT_BYTES * 4
-- Caps concurrent attachment downloads against a hashing-flood DoS. Matches the
-- typical size of the cross-channel spam bursts this detects (~4 near-simultaneous
-- messages), with a little slack for jitter; a genuine overload beyond that
-- intentionally drops rather than queues.
local MAX_CONCURRENT_HASHES = 4
local ATTACHMENT_FETCH_TIMEOUT_MS = 10 * 1000
local TIMEOUT_SECONDS = 60 * 60
local LOG_CHANNEL_ID = snowflakes.channels.modlogs

--- Normalized Levenshtein similarity between two strings, in [0, 1].
-- string.levenshtein comes from discordia.extensions.string(), loaded in main.lua.
local function similarity(a, b)
  return 1 - a:levenshtein(b) / math.max(#a, #b, 1)
end

--- Lowercases and collapses whitespace so near-identical text compares equal.
local function normalize(text)
  return text:trim():lower():gsub('%s+', ' ')
end

local activeHashes = 0

--- Downloads an attachment and returns its SHA-256 hex digest, or nil if it can't be hashed.
local function hashAttachment(att)
  if att.size and att.size > MAX_ATTACHMENT_BYTES then return nil end
  if activeHashes >= MAX_CONCURRENT_HASHES then return nil end

  activeHashes = activeHashes + 1
  local ok, res, body = pcall(http.request, 'GET', att.url, nil, nil, ATTACHMENT_FETCH_TIMEOUT_MS)
  activeHashes = activeHashes - 1

  if not ok or not res or res.code ~= 200 then return nil end
  if #body > MAX_ATTACHMENT_BYTES then return nil end
  return openssl.hex(openssl.digest.digest('sha256', body))
end

local buffers = {} -- guildId -> userId -> entry[]

--- Drops buffered entries older than WINDOW_MS.
local function notExpired(entries, now)
  local kept = {}
  for _, e in ipairs(entries) do
    if now - e.timestamp <= WINDOW_MS then
      table.insert(kept, e)
    end
  end
  return kept
end

--- True if two entries share an attachment hash or have near-identical text.
local function isMatch(a, b)
  for _, h in ipairs(a.hashes) do
    for _, h2 in ipairs(b.hashes) do
      if h == h2 then return true end
    end
  end
  if #a.text >= 4 and #b.text >= 4 and similarity(a.text, b.text) >= TEXT_SIMILARITY_THRESHOLD then
    return true
  end
  return false
end

--- Records a message and, once matches span >= CHANNEL_THRESHOLD distinct channels,
--- returns the matched entries plus the buffer key. The buffer itself is left
--- intact until the caller confirms moderation actually went through.
local function recordAndCheck(message)
  local attachments = message.attachments
  if not attachments or #attachments == 0 then return nil end
  if #attachments > MAX_ATTACHMENTS_PER_MESSAGE then return nil end

  local totalSize = 0
  for _, att in ipairs(attachments) do
    totalSize = totalSize + (att.size or 0)
  end
  if totalSize > MAX_TOTAL_BYTES_PER_MESSAGE then return nil end

  local hashes = {}
  for _, att in ipairs(attachments) do
    local h = hashAttachment(att)
    if h then table.insert(hashes, h) end
  end
  if #hashes == 0 then return nil end

  local entry = {
    timestamp = os.time() * 1000,
    channelId = message.channel.id,
    message = message,
    hashes = hashes,
    text = normalize(message.content or ''),
  }

  local guildId = message.guild.id
  buffers[guildId] = buffers[guildId] or {}
  local userBuffers = buffers[guildId]
  local existing = notExpired(userBuffers[message.author.id] or {}, entry.timestamp)

  local matched, channels, channelCount = {}, {}, 0
  local function track(e)
    table.insert(matched, e)
    if not channels[e.channelId] then
      channels[e.channelId] = true
      channelCount = channelCount + 1
    end
  end

  for _, e in ipairs(existing) do
    if isMatch(e, entry) then track(e) end
  end
  track(entry)

  if channelCount >= CHANNEL_THRESHOLD then
    return matched, guildId, message.author.id
  end

  table.insert(existing, entry)
  userBuffers[message.author.id] = existing
  return nil
end

timer.setInterval(WINDOW_MS, function()
  local now = os.time() * 1000
  for guildId, userBuffers in pairs(buffers) do
    for userId, entries in pairs(userBuffers) do
      local kept = notExpired(entries, now)
      userBuffers[userId] = #kept > 0 and kept or nil
    end
    if not next(userBuffers) then
      buffers[guildId] = nil
    end
  end
end)

--- Deletes the clustered messages, times out the author, and reports to modlogs.
--- Returns whether moderation actually happened, so the caller only clears the
--- buffered cluster once it has.
local function handleCluster(message, cluster)
  -- message.member can be nil for an uncached member; resolve it before deleting
  -- anything so a failure here doesn't leave messages deleted with no timeout/log.
  local member = message.guild:getMember(message.author.id)
  if not member then return false end

  local channelIds, seen = {}, {}
  for _, e in ipairs(cluster) do
    if not seen[e.channelId] then
      seen[e.channelId] = true
      table.insert(channelIds, e.channelId)
    end
  end

  local deleted = 0
  for _, e in ipairs(cluster) do
    if e.message:delete() then deleted = deleted + 1 end
  end

  local timeoutOk, timeoutErr = member:timeoutFor(TIMEOUT_SECONDS)

  local modlogs = message.guild:getChannel(LOG_CHANNEL_ID)
  if not modlogs then return true end

  local mentions = {}
  for _, id in ipairs(channelIds) do
    table.insert(mentions, '<#' .. id .. '>')
  end

  modlogs:send {
    embed = {
      title = 'Cross-channel spam detected',
      color = 0xED4245,
      fields = {
        { name = 'User', value = string.format('<@%s> (%s)', message.author.id, message.author.tag) },
        { name = 'Channels', value = table.concat(mentions, ', ') },
        { name = 'Messages matched', value = tostring(#cluster), inline = true },
        { name = 'Messages deleted', value = string.format('%d/%d', deleted, #cluster), inline = true },
        {
          name = 'Timeout',
          value = timeoutOk and string.format('%dm', math.floor(TIMEOUT_SECONDS / 60)) or ('Failed: ' .. tostring(timeoutErr)),
          inline = true,
        },
        {
          name = 'Softban',
          value = string.format('```\n?softban %s compromised account\n```', message.author.id),
        },
      },
      footer = { text = 'ID: ' .. message.author.id },
      timestamp = os.date('!%Y-%m-%dT%H:%M:%SZ'),
    }
  }

  return true
end

return {
  --- Returns true if the message was spam and got moderated (deleted + timed out).
  check = function(message)
    if not message.guild or message.author.bot then return false end
    local ok, result = pcall(function()
      local cluster, guildId, authorId = recordAndCheck(message)
      if not cluster then return false end
      local moderated = handleCluster(message, cluster)
      if moderated then
        local userBuffers = buffers[guildId]
        if userBuffers then userBuffers[authorId] = nil end
      end
      return moderated
    end)
    if not ok then
      print('spam detection failed: ' .. tostring(result))
      return false
    end
    return result
  end
}
